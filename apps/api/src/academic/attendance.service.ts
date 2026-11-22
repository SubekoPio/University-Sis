// Purpose: Import presence, calculate attendance outcomes, and report percentages.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  AttendanceMethod,
  AttendanceStatus,
  ClassSessionStatus,
  DeliveryMode,
} from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { normalizeRequiredText } from "./academic.validation.js";
import { computeContinuousPresence } from "./attendance.presence.js";
import { AttendanceRepository, type AttendanceSessionRoster } from "./attendance.repository.js";
import { HomeCacheService } from "./home-cache.service.js";
import type {
  AttendanceOutcomeInput,
  AttendancePresenceEvent,
  StudentAttendanceSummary,
  UnmatchedPresenceRow,
} from "./attendance.types.js";
import { TimetableRepository } from "./timetable.repository.js";

const ATTENDANCE_RECORD_PERMISSION = "academic:attendance:record_assigned";
const ATTENDANCE_OVERRIDE_PERMISSION = "attendance:override";
const ATTENDANCE_READ_OWN_PERMISSION = "academic:attendance:read_own";

type ParsedPresenceRow = UnmatchedPresenceRow;

/** Provides presence ingestion, attendance computation, physical marking, and summaries. */
@Injectable()
export class AttendanceService {
  /** Receives attendance persistence, timetable assignment scope, and RBAC services. */
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly timetableRepository: TimetableRepository,
    private readonly rbac: RbacService,
    private readonly homeCache: HomeCacheService,
  ) {}

  /** Imports an RFC 4180 CSV report and returns rows whose emails are not on the roster. */
  async importPresenceReport(
    sessionId: string,
    csv: string,
    actorId: string,
  ): Promise<{ importedIntervals: number; unmatchedRows: UnmatchedPresenceRow[] }> {
    const session = await this.getAssignedSession(sessionId, actorId, ATTENDANCE_RECORD_PERMISSION);
    this.assertImportableOnlineSession(session, true);
    const rows = this.parsePresenceCsv(csv);
    const studentByEmail = new Map(
      session.offering.registrations.map(({ studentId, student }) => [
        student.user.email.trim().toLowerCase(),
        studentId,
      ]),
    );
    const events: AttendancePresenceEvent[] = [];
    const unmatchedRows: UnmatchedPresenceRow[] = [];
    for (const row of rows) {
      const studentId = studentByEmail.get(row.email.toLowerCase());
      if (studentId === undefined) {
        unmatchedRows.push(row);
      } else {
        events.push({
          studentId,
          joinedAt: row.joinedAt,
          leftAt: row.leftAt,
        });
      }
    }

    const result = await this.repository.insertPresenceIntervals(
      session.id,
      events,
      "REPORT_IMPORT",
    );
    return {
      importedIntervals: this.readInsertCount(result),
      unmatchedRows,
    };
  }

  /** Ingests normalized provider intervals for roster students. */
  async ingestPresenceEvents(
    sessionId: string,
    events: readonly AttendancePresenceEvent[],
  ): Promise<{ importedIntervals: number }> {
    const id = this.validateUuid(sessionId, "Session ID");
    const session = await this.getSession(id);
    this.assertImportableOnlineSession(session, false);
    const roster = new Set(session.offering.registrations.map(({ studentId }) => studentId));
    const normalized = events.map((event) => {
      const studentId = this.validateUuid(event.studentId, "Student ID");
      this.validateInterval(event.joinedAt, event.leftAt);
      if (!roster.has(studentId)) {
        throw new BadRequestException("Presence events must belong to a selected student.");
      }
      return { ...event, studentId };
    });

    const result = await this.repository.insertPresenceIntervals(
      session.id,
      normalized,
      "PROVIDER_WEBHOOK",
    );
    return { importedIntervals: this.readInsertCount(result) };
  }

  /** Computes each roster student's result after the session ends; repeated runs are safe. */
  async computeSessionAttendance(
    sessionId: string,
  ): Promise<{ computedCount: number; updatedCount: number; presentCount: number }> {
    const id = this.validateUuid(sessionId, "Session ID");
    const computedAt = new Date();
    const result = await this.repository.computeSessionAttendance(
      id,
      computedAt,
      (snapshot): AttendanceOutcomeInput[] => {
        if (snapshot.session.status === ClassSessionStatus.CANCELLED) {
          throw new ConflictException("Attendance cannot be computed for a cancelled session.");
        }
        if (snapshot.session.endsAt.getTime() > computedAt.getTime()) {
          throw new ConflictException("Attendance can be computed only after the session ends.");
        }
        if (snapshot.session.deliveryMode === DeliveryMode.PHYSICAL) {
          throw new ConflictException("Physical attendance must be marked by the lecturer.");
        }
        if (snapshot.rule === null) {
          throw new InternalServerErrorException("The global attendance rule is not initialized.");
        }
        const rule = snapshot.rule;

        return snapshot.students.map(({ studentId, intervals }) => ({
          studentId,
          method: AttendanceMethod.ONLINE_PRESENCE,
          ...computeContinuousPresence(intervals, snapshot.session, rule),
        }));
      },
    );
    if (result.kind === "not-found") {
      throw new NotFoundException("Class session not found.");
    }
    if (result.computedCount > 0) {
      const session = await this.repository.findSessionRoster(id);
      if (session === null) {
        throw new NotFoundException("Class session not found after attendance computation.");
      }
      await this.invalidateStudentHomes(
        await this.repository.findActiveStudentUserIds(
          session.offering.registrations.map(({ studentId }) => studentId),
        ),
      );
    }
    return {
      computedCount: result.computedCount,
      updatedCount: result.updatedCount,
      presentCount: result.presentCount,
    };
  }

  /** Marks one student's attendance for an ended physical session. */
  markPhysicalAttendance(
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    actorId: string,
  ): Promise<{ markedCount: number }> {
    return this.markPhysicalAttendanceBulk(sessionId, [{ studentId, status }], actorId);
  }

  /** Marks a group of students for an ended physical session atomically. */
  async markPhysicalAttendanceBulk(
    sessionId: string,
    marks: readonly { studentId: string; status: AttendanceStatus }[],
    actorId: string,
  ): Promise<{ markedCount: number }> {
    const session = await this.getAssignedSession(sessionId, actorId, ATTENDANCE_RECORD_PERMISSION);
    const normalizedMarks = this.validateMarks(marks);
    const result = await this.repository.markPhysicalAttendance(
      session.id,
      normalizedMarks,
      actorId,
      new Date(),
    );
    if (result.kind === "marked") {
      await this.invalidateStudentHomes(
        await this.repository.findActiveStudentUserIds(
          session.offering.registrations.map(({ studentId }) => studentId),
        ),
      );
      return { markedCount: result.markedCount };
    }
    this.throwPhysicalAttendanceError(result.kind);
  }

  /** Overrides a stored outcome with a required reason and an audit record. */
  async overrideAttendance(
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    reason: string,
    actorId: string,
  ): Promise<{ previousStatus: AttendanceStatus; status: AttendanceStatus }> {
    const session = await this.getAssignedSession(
      sessionId,
      actorId,
      ATTENDANCE_OVERRIDE_PERMISSION,
    );
    const student = this.validateUuid(studentId, "Student ID");
    this.validateStatus(status);
    const normalizedReason = normalizeRequiredText(reason, "Attendance override reason");
    const result = await this.repository.overrideAttendance(
      session.id,
      student,
      status,
      actorId,
      normalizedReason,
      new Date(),
    );
    if (result.kind === "overridden") {
      await this.invalidateStudentHomes(
        await this.repository.findActiveStudentUserIds([
          ...session.offering.registrations.map(({ studentId }) => studentId),
          student,
        ]),
      );
      return { previousStatus: result.previousStatus, status };
    }
    if (result.kind === "not-found") {
      throw new NotFoundException("Class session not found.");
    }
    if (result.kind === "cancelled") {
      throw new ConflictException("Attendance cannot be overridden for a cancelled session.");
    }
    if (result.kind === "session-not-ended") {
      throw new ConflictException("Attendance can be overridden only after the session ends.");
    }
    throw new NotFoundException("An attendance outcome must exist before it can be overridden.");
  }

  /** Returns per-offering and overall intake percentages for the authenticated student. */
  async getStudentAttendanceSummary(
    studentId: string,
    intakeId: string,
    actorId: string,
  ): Promise<StudentAttendanceSummary> {
    const student = this.validateUuid(studentId, "Student ID");
    const intake = this.validateUuid(intakeId, "Intake ID");
    const actor = await this.getActor(actorId);
    if (!actor.permissions.includes(ATTENDANCE_READ_OWN_PERMISSION)) {
      throw new ForbiddenException(`The ${ATTENDANCE_READ_OWN_PERMISSION} permission is required.`);
    }

    const userId = await this.repository.findActiveStudentUserId(student);
    if (userId === null) {
      throw new NotFoundException("Active student not found.");
    }
    if (userId !== actorId) {
      throw new ForbiddenException("Students may view only their own attendance summary.");
    }
    if (!(await this.repository.hasActiveIntake(intake))) {
      throw new NotFoundException("Intake not found.");
    }
    const rule = await this.repository.findAttendanceRule();
    if (rule === null) {
      throw new InternalServerErrorException("The global attendance rule is not initialized.");
    }

    const registrations = await this.repository.findStudentAttendanceRows(student, intake);
    const offerings = registrations.map(({ offeringId, offering }) => {
      const heldSessions = offering.classSessions.length;
      const presentSessions = offering.classSessions.filter((session) =>
        session.attendanceRecords.some(({ status }) => status === AttendanceStatus.PRESENT),
      ).length;
      return {
        offeringId,
        courseUnitCode: offering.courseUnit.code,
        courseUnitName: offering.courseUnit.name,
        heldSessions,
        presentSessions,
        percentage: this.percentage(presentSessions, heldSessions),
        belowMinimum: this.isBelowMinimum(
          presentSessions,
          heldSessions,
          rule.minAttendancePercentWarning,
        ),
      };
    });
    const heldSessions = offerings.reduce((total, offering) => total + offering.heldSessions, 0);
    const presentSessions = offerings.reduce(
      (total, offering) => total + offering.presentSessions,
      0,
    );
    return {
      studentId: student,
      intakeId: intake,
      minimumPercent: rule.minAttendancePercentWarning,
      offerings,
      overall: {
        heldSessions,
        presentSessions,
        percentage: this.percentage(presentSessions, heldSessions),
        belowMinimum: this.isBelowMinimum(
          presentSessions,
          heldSessions,
          rule.minAttendancePercentWarning,
        ),
      },
    };
  }

  private async getAssignedSession(
    sessionId: string,
    actorId: string,
    permission: string,
  ): Promise<AttendanceSessionRoster> {
    const id = this.validateUuid(sessionId, "Session ID");
    const actor = await this.getActor(actorId);
    if (!actor.permissions.includes(permission)) {
      throw new ForbiddenException(`The ${permission} permission is required.`);
    }
    const session = await this.getSession(id);
    if (
      !(await this.timetableRepository.isLecturerAssignedToOffering(actorId, session.offering.id))
    ) {
      throw new ForbiddenException("Lecturers may manage attendance only for assigned offerings.");
    }
    return session;
  }

  private async getSession(sessionId: string): Promise<AttendanceSessionRoster> {
    const session = await this.repository.findSessionRoster(sessionId);
    if (session === null) {
      throw new NotFoundException("Class session not found.");
    }
    return session;
  }

  private async getActor(actorId: string) {
    const id = this.validateUuid(actorId, "Actor ID");
    const actor = await this.rbac.getAuthorizationSnapshot(id);
    if (actor.permissions.length === 0) {
      throw new ForbiddenException("An active account with academic permissions is required.");
    }
    return actor;
  }

  private assertImportableOnlineSession(
    session: AttendanceSessionRoster,
    requireEnded: boolean,
  ): void {
    if (session.status === ClassSessionStatus.CANCELLED) {
      throw new ConflictException("Presence cannot be imported for a cancelled session.");
    }
    if (session.deliveryMode === DeliveryMode.PHYSICAL) {
      throw new ConflictException("Presence reports can be imported only for online sessions.");
    }
    if (requireEnded && session.endsAt.getTime() > Date.now()) {
      throw new ConflictException("Presence can be imported only after the session ends.");
    }
  }

  private parsePresenceCsv(csv: string): ParsedPresenceRow[] {
    if (typeof csv !== "string" || csv.trim().length === 0) {
      throw new BadRequestException("The attendance CSV is empty.");
    }
    const rows = this.parseCsvRows(csv.replace(/^\uFEFF/, ""));
    const headers = rows[0]?.map((header) => header.trim().toLowerCase());
    if (headers === undefined) {
      throw new BadRequestException("The attendance CSV is missing its header row.");
    }
    const emailColumn = headers.indexOf("email");
    const joinColumn = headers.indexOf("join");
    const leaveColumn = headers.indexOf("leave");
    if (emailColumn < 0 || joinColumn < 0 || leaveColumn < 0) {
      throw new BadRequestException(
        "The attendance CSV must include email, join, and leave columns.",
      );
    }

    const parsed: ParsedPresenceRow[] = [];
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (row === undefined || row.every((cell) => cell.trim().length === 0)) {
        continue;
      }
      const email = row[emailColumn]?.trim().toLowerCase() ?? "";
      const joinedAt = this.parseTimestamp(row[joinColumn], index + 1, "join");
      const leftAt = this.parseTimestamp(row[leaveColumn], index + 1, "leave");
      if (email.length === 0 || !email.includes("@")) {
        throw new BadRequestException(`Attendance CSV row ${index + 1} has an invalid email.`);
      }
      this.validateInterval(joinedAt, leftAt, index + 1);
      parsed.push({ rowNumber: index + 1, email, joinedAt, leftAt });
    }
    return parsed;
  }

  private parseCsvRows(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    let afterQuote = false;
    for (let index = 0; index < csv.length; index += 1) {
      const character = csv[index];
      if (character === undefined) {
        continue;
      }
      if (quoted) {
        if (character === '"') {
          if (csv[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
            afterQuote = true;
          }
        } else {
          cell += character;
        }
        continue;
      }
      if (afterQuote) {
        if (character === " " || character === "\t") {
          continue;
        }
        if (character !== "," && character !== "\r" && character !== "\n") {
          throw new BadRequestException("The attendance CSV contains an invalid quoted field.");
        }
      } else if (character === '"') {
        if (cell.length !== 0) {
          throw new BadRequestException("The attendance CSV contains an invalid quote.");
        }
        quoted = true;
        continue;
      }
      if (character === ",") {
        row.push(cell);
        cell = "";
        afterQuote = false;
      } else if (character === "\r" || character === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        afterQuote = false;
        if (character === "\r" && csv[index + 1] === "\n") {
          index += 1;
        }
      } else {
        cell += character;
        afterQuote = false;
      }
    }
    if (quoted) {
      throw new BadRequestException("The attendance CSV contains an unterminated quoted field.");
    }
    if (cell.length > 0 || row.length > 0 || afterQuote) {
      row.push(cell);
      rows.push(row);
    }
    if (rows.length === 0) {
      throw new BadRequestException("The attendance CSV is missing its header row.");
    }
    return rows;
  }

  private parseTimestamp(value: string | undefined, rowNumber: number, label: string): Date {
    if (value === undefined || value.trim().length === 0) {
      throw new BadRequestException(`Attendance CSV row ${rowNumber} is missing ${label} time.`);
    }
    const parsed = new Date(value.trim());
    if (!Number.isFinite(parsed.getTime())) {
      throw new BadRequestException(
        `Attendance CSV row ${rowNumber} has an invalid ${label} time.`,
      );
    }
    return parsed;
  }

  private validateInterval(joinedAt: Date, leftAt: Date, rowNumber?: number): void {
    if (
      !(joinedAt instanceof Date) ||
      !Number.isFinite(joinedAt.getTime()) ||
      !(leftAt instanceof Date) ||
      !Number.isFinite(leftAt.getTime()) ||
      leftAt.getTime() < joinedAt.getTime()
    ) {
      const suffix = rowNumber === undefined ? "" : ` on row ${rowNumber}`;
      throw new BadRequestException(`Presence leave time must not be before join time${suffix}.`);
    }
  }

  private validateMarks(
    marks: readonly { studentId: string; status: AttendanceStatus }[],
  ): Array<{ studentId: string; status: AttendanceStatus }> {
    if (marks.length === 0) {
      throw new BadRequestException("At least one student attendance mark is required.");
    }
    const studentIds = new Set<string>();
    return marks.map(({ studentId, status }) => {
      const id = this.validateUuid(studentId, "Student ID");
      this.validateStatus(status);
      if (studentIds.has(id)) {
        throw new BadRequestException("A student may be marked only once per bulk operation.");
      }
      studentIds.add(id);
      return { studentId: id, status };
    });
  }

  private validateStatus(status: AttendanceStatus): void {
    if (!Object.values(AttendanceStatus).includes(status)) {
      throw new BadRequestException("The selected attendance status is invalid.");
    }
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }

  private readInsertCount(
    result: Awaited<ReturnType<AttendanceRepository["insertPresenceIntervals"]>>,
  ): number {
    if (result.kind === "inserted") {
      return result.count;
    }
    if (result.kind === "not-found") {
      throw new NotFoundException("Class session not found.");
    }
    if (result.kind === "cancelled") {
      throw new ConflictException("Presence cannot be imported for a cancelled session.");
    }
    throw new ConflictException("Presence intervals must belong to selected students.");
  }

  private throwPhysicalAttendanceError(
    kind: Exclude<
      Awaited<ReturnType<AttendanceRepository["markPhysicalAttendance"]>>["kind"],
      "marked"
    >,
  ): never {
    if (kind === "not-found") {
      throw new NotFoundException("Class session not found.");
    }
    if (kind === "cancelled") {
      throw new ConflictException("Attendance cannot be marked for a cancelled session.");
    }
    if (kind === "wrong-delivery-mode") {
      throw new ConflictException("Lecturer marking is available only for physical sessions.");
    }
    if (kind === "session-not-ended") {
      throw new ConflictException("Physical attendance can be marked only after the session ends.");
    }
    if (kind === "students-not-enrolled") {
      throw new ConflictException("Attendance can be marked only for enrolled students.");
    }
    throw new ConflictException(
      "An overridden attendance record must be changed through override.",
    );
  }

  private percentage(present: number, held: number): number | null {
    return held === 0 ? null : Math.round((present / held) * 10_000) / 100;
  }

  private async invalidateStudentHomes(userIds: readonly string[]): Promise<void> {
    await Promise.all([...new Set(userIds)].map((userId) => this.homeCache.invalidateUser(userId)));
  }

  private isBelowMinimum(present: number, held: number, minimum: number): boolean {
    return held > 0 && (present / held) * 100 < minimum;
  }
}
