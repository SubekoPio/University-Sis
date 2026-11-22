// Purpose: Persist attendance intervals, outcomes, overrides, and report inputs.
import { Injectable } from "@nestjs/common";
import {
  AttendanceMethod,
  AttendanceStatus,
  ClassSessionStatus,
  DeliveryMode,
  Prisma,
  UnitRegistrationStatus,
} from "@prisma/client";
import type { AttendanceCalculator, AttendancePresenceEvent } from "./attendance.types.js";
import { PrismaService } from "../database/prisma.service.js";

const rosterRegistrationStatuses = [
  UnitRegistrationStatus.SELECTED,
  UnitRegistrationStatus.COMPLETED,
];

const sessionRosterSelect = {
  id: true,
  offeringId: true,
  startsAt: true,
  endsAt: true,
  deliveryMode: true,
  status: true,
  offering: {
    select: {
      id: true,
      intakeId: true,
      registrations: {
        where: { status: { in: rosterRegistrationStatuses } },
        select: {
          studentId: true,
          student: { select: { user: { select: { email: true } } } },
        },
      },
    },
  },
} satisfies Prisma.ClassSessionSelect;

/** Session and enrolled-student details used for reports and attendance actions. */
export type AttendanceSessionRoster = Prisma.ClassSessionGetPayload<{
  select: typeof sessionRosterSelect;
}>;

/** Result of inserting normalized attendance intervals. */
export type InsertPresenceOutcome =
  | { kind: "not-found" }
  | { kind: "cancelled" }
  | { kind: "students-not-enrolled" }
  | { kind: "inserted"; count: number };

/** Result of a transaction that computes attendance for an ended session. */
export type ComputeAttendanceOutcome =
  | { kind: "not-found" }
  | {
      kind: "computed";
      computedCount: number;
      updatedCount: number;
      presentCount: number;
    };

/** Result of recording physical attendance for a session roster. */
export type PhysicalAttendanceOutcome =
  | { kind: "not-found" }
  | { kind: "cancelled" }
  | { kind: "wrong-delivery-mode" }
  | { kind: "session-not-ended" }
  | { kind: "students-not-enrolled" }
  | { kind: "already-overridden" }
  | { kind: "marked"; markedCount: number };

/** Result of applying an audited attendance override. */
export type AttendanceOverrideOutcome =
  | { kind: "not-found" }
  | { kind: "cancelled" }
  | { kind: "session-not-ended" }
  | { kind: "record-not-found" }
  | { kind: "overridden"; previousStatus: AttendanceStatus };

/** Prisma persistence operations for attendance workflows. */
@Injectable()
export class AttendanceRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Loads a session and the students currently selected or completed in its offering. */
  findSessionRoster(sessionId: string): Promise<AttendanceSessionRoster | null> {
    return this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: sessionRosterSelect,
    });
  }

  /** Returns an active student's authentication user ID for own-record checks. */
  async findActiveStudentUserId(studentId: string): Promise<string | null> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, user: { is: { status: "ACTIVE" } } },
      select: { userId: true },
    });
    return student?.userId ?? null;
  }

  /** Loads active authentication IDs for a batch of student profiles. */
  async findActiveStudentUserIds(studentIds: readonly string[]): Promise<string[]> {
    if (studentIds.length === 0) {
      return [];
    }
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: [...new Set(studentIds)] },
        user: { is: { status: "ACTIVE" } },
      },
      select: { userId: true },
    });
    return students.map(({ userId }) => userId);
  }

  /** Checks that an active intake exists before an attendance summary is calculated. */
  async hasActiveIntake(intakeId: string): Promise<boolean> {
    const intake = await this.prisma.intake.findFirst({
      where: {
        id: intakeId,
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
      },
      select: { id: true },
    });
    return intake !== null;
  }

  /** Loads the configured singleton rule; callers must handle an uninitialized row. */
  findAttendanceRule() {
    return this.prisma.attendanceRule.findUnique({ where: { id: 1 } });
  }

  /** Inserts new report/provider intervals once per source and exact interval. */
  insertPresenceIntervals(
    sessionId: string,
    events: readonly AttendancePresenceEvent[],
    source: "REPORT_IMPORT" | "PROVIDER_WEBHOOK",
  ): Promise<InsertPresenceOutcome> {
    return this.prisma.$transaction(async (transaction) => {
      const sessionExists = await this.lockSession(transaction, sessionId);
      if (!sessionExists) {
        return { kind: "not-found" };
      }

      const session = await transaction.classSession.findUnique({
        where: { id: sessionId },
        select: {
          status: true,
          offering: {
            select: {
              registrations: {
                where: { status: { in: rosterRegistrationStatuses } },
                select: { studentId: true },
              },
            },
          },
        },
      });
      if (session === null) {
        return { kind: "not-found" };
      }
      if (session.status === ClassSessionStatus.CANCELLED) {
        return { kind: "cancelled" };
      }

      const roster = new Set(session.offering.registrations.map(({ studentId }) => studentId));
      if (events.some(({ studentId }) => !roster.has(studentId))) {
        return { kind: "students-not-enrolled" };
      }
      if (events.length === 0) {
        return { kind: "inserted", count: 0 };
      }

      const studentIds = [...new Set(events.map(({ studentId }) => studentId))];
      const existing = await transaction.presenceInterval.findMany({
        where: { sessionId, source, studentId: { in: studentIds } },
        select: { studentId: true, joinedAt: true, leftAt: true },
      });
      const keys = new Set(
        existing.map(({ studentId, joinedAt, leftAt }) =>
          this.intervalKey(studentId, joinedAt, leftAt),
        ),
      );
      const missing = new Map<string, AttendancePresenceEvent>();
      for (const event of events) {
        const key = this.intervalKey(event.studentId, event.joinedAt, event.leftAt);
        if (!keys.has(key)) {
          missing.set(key, event);
        }
      }
      if (missing.size === 0) {
        return { kind: "inserted", count: 0 };
      }

      const result = await transaction.presenceInterval.createMany({
        data: [...missing.values()].map((event) => ({
          sessionId,
          studentId: event.studentId,
          joinedAt: event.joinedAt,
          leftAt: event.leftAt,
          source,
        })),
      });
      return { kind: "inserted", count: result.count };
    });
  }

  /** Loads a locked attendance snapshot, computes outcomes, and upserts them atomically. */
  computeSessionAttendance(
    sessionId: string,
    computedAt: Date,
    calculate: AttendanceCalculator,
  ): Promise<ComputeAttendanceOutcome> {
    return this.prisma.$transaction(async (transaction) => {
      const sessionExists = await this.lockSession(transaction, sessionId);
      if (!sessionExists) {
        return { kind: "not-found" };
      }
      const session = await transaction.classSession.findUnique({
        where: { id: sessionId },
        select: sessionRosterSelect,
      });
      if (session === null) {
        return { kind: "not-found" };
      }

      const studentIds = session.offering.registrations.map(({ studentId }) => studentId);
      const [rule, intervals] = await Promise.all([
        transaction.attendanceRule.findUnique({ where: { id: 1 } }),
        studentIds.length === 0
          ? Promise.resolve([])
          : transaction.presenceInterval.findMany({
              where: { sessionId, studentId: { in: studentIds } },
              orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
              select: { studentId: true, joinedAt: true, leftAt: true },
            }),
      ]);
      const intervalsByStudent = new Map<string, AttendancePresenceEvent[]>();
      for (const interval of intervals) {
        const studentIntervals = intervalsByStudent.get(interval.studentId) ?? [];
        studentIntervals.push({ ...interval, studentId: interval.studentId });
        intervalsByStudent.set(interval.studentId, studentIntervals);
      }
      const outcomes = calculate({
        session: {
          id: session.id,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          deliveryMode: session.deliveryMode,
          status: session.status,
        },
        rule,
        students: studentIds.map((studentId) => ({
          studentId,
          intervals: intervalsByStudent.get(studentId) ?? [],
        })),
      });

      if (session.status === ClassSessionStatus.SCHEDULED) {
        await transaction.classSession.updateMany({
          where: { id: sessionId, status: ClassSessionStatus.SCHEDULED },
          data: { status: ClassSessionStatus.HELD },
        });
      }

      const roster = new Set(studentIds);
      if (outcomes.some(({ studentId }) => !roster.has(studentId))) {
        throw new Error("Attendance calculation returned a student outside the session roster.");
      }
      let updatedCount = 0;
      for (const outcome of outcomes) {
        const where = { sessionId_studentId: { sessionId, studentId: outcome.studentId } };
        const existing = await transaction.attendanceRecord.findUnique({ where });
        if (existing !== null && existing.overriddenById !== null) {
          continue;
        }
        if (
          existing !== null &&
          existing.status === outcome.status &&
          existing.method === outcome.method &&
          existing.longestContinuousSeconds === outcome.longestContinuousSeconds &&
          existing.totalSeconds === outcome.totalSeconds
        ) {
          continue;
        }

        await transaction.attendanceRecord.upsert({
          where,
          create: {
            ...outcome,
            sessionId,
            computedAt,
          },
          update: {
            status: outcome.status,
            method: outcome.method,
            longestContinuousSeconds: outcome.longestContinuousSeconds,
            totalSeconds: outcome.totalSeconds,
            computedAt,
            overriddenById: null,
            overrideReason: null,
          },
        });
        updatedCount += 1;
      }
      return {
        kind: "computed",
        computedCount: outcomes.length,
        updatedCount,
        presentCount: outcomes.filter(({ status }) => status === AttendanceStatus.PRESENT).length,
      };
    });
  }

  /** Marks physical attendance in one transaction and writes one audit item per student. */
  markPhysicalAttendance(
    sessionId: string,
    marks: readonly { studentId: string; status: AttendanceStatus }[],
    actorId: string,
    markedAt: Date,
  ): Promise<PhysicalAttendanceOutcome> {
    return this.prisma.$transaction(async (transaction) => {
      const sessionExists = await this.lockSession(transaction, sessionId);
      if (!sessionExists) {
        return { kind: "not-found" };
      }
      const session = await transaction.classSession.findUnique({
        where: { id: sessionId },
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          deliveryMode: true,
          offering: {
            select: {
              registrations: {
                where: { status: { in: rosterRegistrationStatuses } },
                select: { studentId: true },
              },
            },
          },
        },
      });
      if (session === null) {
        return { kind: "not-found" };
      }
      if (session.status === ClassSessionStatus.CANCELLED) {
        return { kind: "cancelled" };
      }
      if (session.deliveryMode !== DeliveryMode.PHYSICAL) {
        return { kind: "wrong-delivery-mode" };
      }
      if (session.endsAt.getTime() > markedAt.getTime()) {
        return { kind: "session-not-ended" };
      }

      const roster = new Set(session.offering.registrations.map(({ studentId }) => studentId));
      if (marks.some(({ studentId }) => !roster.has(studentId))) {
        return { kind: "students-not-enrolled" };
      }
      const studentIds = marks.map(({ studentId }) => studentId);
      const existing = await transaction.attendanceRecord.findMany({
        where: { sessionId, studentId: { in: studentIds } },
        select: { studentId: true, overriddenById: true },
      });
      if (existing.some(({ overriddenById }) => overriddenById !== null)) {
        return { kind: "already-overridden" };
      }

      if (session.status === ClassSessionStatus.SCHEDULED) {
        await transaction.classSession.updateMany({
          where: { id: sessionId, status: ClassSessionStatus.SCHEDULED },
          data: { status: ClassSessionStatus.HELD },
        });
      }
      const auditEvents: Prisma.AuditLogCreateManyInput[] = [];
      for (const mark of marks) {
        const record = await transaction.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId, studentId: mark.studentId } },
          create: {
            sessionId,
            studentId: mark.studentId,
            status: mark.status,
            method: AttendanceMethod.LECTURER_MARKED,
            longestContinuousSeconds: 0,
            totalSeconds: 0,
            computedAt: markedAt,
          },
          update: {
            status: mark.status,
            method: AttendanceMethod.LECTURER_MARKED,
            longestContinuousSeconds: 0,
            totalSeconds: 0,
            computedAt: markedAt,
            overriddenById: null,
            overrideReason: null,
          },
          select: { id: true },
        });
        auditEvents.push({
          actorId,
          action: "attendance.physical_marked",
          resourceType: "attendance_record",
          resourceId: record.id,
          metadata: { sessionId, studentId: mark.studentId, status: mark.status },
        });
      }
      if (auditEvents.length > 0) {
        await transaction.auditLog.createMany({ data: auditEvents });
      }
      return { kind: "marked", markedCount: marks.length };
    });
  }

  /** Applies a reasoned attendance override and its audit event atomically. */
  overrideAttendance(
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    actorId: string,
    reason: string,
    overriddenAt: Date,
  ): Promise<AttendanceOverrideOutcome> {
    return this.prisma.$transaction(async (transaction) => {
      const sessionExists = await this.lockSession(transaction, sessionId);
      if (!sessionExists) {
        return { kind: "not-found" };
      }
      const session = await transaction.classSession.findUnique({
        where: { id: sessionId },
        select: { status: true, endsAt: true },
      });
      if (session === null) {
        return { kind: "not-found" };
      }
      if (session.status === ClassSessionStatus.CANCELLED) {
        return { kind: "cancelled" };
      }
      if (session.endsAt.getTime() > overriddenAt.getTime()) {
        return { kind: "session-not-ended" };
      }
      const where = { sessionId_studentId: { sessionId, studentId } };
      const existing = await transaction.attendanceRecord.findUnique({ where });
      if (existing === null) {
        return { kind: "record-not-found" };
      }
      if (session.status === ClassSessionStatus.SCHEDULED) {
        await transaction.classSession.updateMany({
          where: { id: sessionId, status: ClassSessionStatus.SCHEDULED },
          data: { status: ClassSessionStatus.HELD },
        });
      }
      await transaction.attendanceRecord.update({
        where,
        data: {
          status,
          method: AttendanceMethod.LECTURER_MARKED,
          computedAt: overriddenAt,
          overriddenById: actorId,
          overrideReason: reason,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "attendance.record_overridden",
          resourceType: "attendance_record",
          resourceId: existing.id,
          reason,
          metadata: {
            sessionId,
            studentId,
            from: existing.status,
            to: status,
          },
        },
      });
      return { kind: "overridden", previousStatus: existing.status };
    });
  }

  /** Loads held-session attendance counts for the student's selected offerings in an intake. */
  findStudentAttendanceRows(studentId: string, intakeId: string) {
    return this.prisma.unitRegistration.findMany({
      where: {
        studentId,
        intakeId,
        status: { in: rosterRegistrationStatuses },
      },
      orderBy: [{ offering: { courseUnit: { code: "asc" } } }, { offeringId: "asc" }],
      select: {
        offeringId: true,
        offering: {
          select: {
            courseUnit: { select: { code: true, name: true } },
            classSessions: {
              where: { status: ClassSessionStatus.HELD },
              orderBy: [{ startsAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                attendanceRecords: {
                  where: { studentId },
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    });
  }

  private async lockSession(
    transaction: Prisma.TransactionClient,
    sessionId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ClassSession" WHERE "id" = ${sessionId}::uuid FOR UPDATE
    `;
    return rows.length > 0;
  }

  private intervalKey(studentId: string, joinedAt: Date, leftAt: Date): string {
    return `${studentId}:${joinedAt.getTime()}:${leftAt.getTime()}`;
  }
}
