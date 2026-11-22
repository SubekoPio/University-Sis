// Purpose: Manage recurring class slots and student weekly schedules.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DayOfWeek, DeliveryMode } from "@prisma/client";
import type { EnvironmentConfig } from "../config/environment.config.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import { normalizeRequiredText } from "./academic.validation.js";
import { validateAcademicUuid, validateMeetingUrl } from "./meeting-link.validation.js";
import { TimetableRepository, type GeneratedSessionInput } from "./timetable.repository.js";
import type { TimetableSlotInput, TimetableSlotSummary } from "./timetable.types.js";

const SESSION_MANAGE_PERMISSION = "academic:session:manage";
const OFFERING_MANAGE_PERMISSION = "academic:offering:manage";
const SESSION_ATTEND_PERMISSION = "academic:session:attend";
const WEEKDAYS = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

type OfferingSchedule = NonNullable<
  Awaited<ReturnType<TimetableRepository["findOfferingSchedule"]>>
>;

/** Provides recurring timetable, session-generation, and student schedule workflows. */
@Injectable()
export class TimetableService {
  private readonly allowedMeetingHosts: string[];

  /** Receives timetable persistence, RBAC, and the validated meeting-host allow-list. */
  constructor(
    private readonly repository: TimetableRepository,
    private readonly rbac: RbacService,
    config: ConfigService<EnvironmentConfig, true>,
  ) {
    this.allowedMeetingHosts = config.get("MEETING_ALLOWED_HOSTS", { infer: true });
  }

  /** Lists an offering's slots without exposing any default meeting URLs. */
  async listSlotsForOffering(offeringId: string, actorId: string): Promise<TimetableSlotSummary[]> {
    const id = validateAcademicUuid(offeringId, "Offering ID");
    await this.getOffering(id);
    await this.assertCanManageOffering(actorId, id);
    return this.repository.listSlotsForOffering(id);
  }

  /** Creates a recurring slot after checking room and shared-lecturer clashes. */
  async createSlot(input: TimetableSlotInput, actorId: string): Promise<TimetableSlotSummary> {
    const offeringId = validateAcademicUuid(input.offeringId, "Offering ID");
    const offering = await this.getOffering(offeringId);
    await this.assertCanManageOffering(actorId, offeringId);
    this.assertOfferingSchedulable(offering);

    const normalized = this.normalizeSlot(input, offeringId);
    await this.assertNoSlotClash(offeringId, normalized);
    return this.repository.createSlot(normalized);
  }

  /** Updates a recurring slot while preserving its course-unit offering. */
  async updateSlot(
    slotId: string,
    input: Omit<TimetableSlotInput, "offeringId">,
    actorId: string,
  ): Promise<TimetableSlotSummary> {
    const id = validateAcademicUuid(slotId, "Timetable-slot ID");
    const current = await this.repository.findSlot(id);
    if (current === null) {
      throw new NotFoundException("Timetable slot not found.");
    }

    await this.assertCanManageOffering(actorId, current.offering.id);
    const offering = await this.getOffering(current.offering.id);
    this.assertOfferingSchedulable(offering);
    const normalized = this.normalizeSlot(
      { ...input, offeringId: current.offering.id },
      current.offering.id,
    );
    await this.assertNoSlotClash(current.offering.id, normalized, id);
    return this.repository.updateSlot(id, normalized);
  }

  /** Removes one recurring slot; generated class-session history is retained. */
  async deleteSlot(slotId: string, actorId: string): Promise<void> {
    const id = validateAcademicUuid(slotId, "Timetable-slot ID");
    const current = await this.repository.findSlot(id);
    if (current === null) {
      throw new NotFoundException("Timetable slot not found.");
    }

    await this.assertCanManageOffering(actorId, current.offering.id);
    if (!(await this.repository.deleteSlot(id))) {
      throw new ConflictException("The timetable slot changed before it could be deleted.");
    }
  }

  /** Generates dated sessions for every slot of one offering across its intake. */
  async generateSessionsForOffering(
    offeringId: string,
    actorId: string,
  ): Promise<Awaited<ReturnType<TimetableRepository["createGeneratedSessions"]>>> {
    const id = validateAcademicUuid(offeringId, "Offering ID");
    const offering = await this.getOffering(id);
    await this.assertCanManageOffering(actorId, id);
    this.assertOfferingSchedulable(offering);
    return this.generateFor(
      [offering],
      offering.intake.startDate,
      offering.intake.endDate,
      offering.intake.id,
    );
  }

  /** Generates dated sessions for all scheduled offerings and slots in an intake. */
  async generateSessionsForIntake(
    intakeId: string,
    actorId: string,
  ): Promise<Awaited<ReturnType<TimetableRepository["createGeneratedSessions"]>>> {
    const id = validateAcademicUuid(intakeId, "Intake ID");
    const actor = await this.getActivePermissions(actorId);
    if (!actor.permissions.includes(SESSION_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`The ${SESSION_MANAGE_PERMISSION} permission is required.`);
    }
    const intake = await this.repository.findIntakeSchedule(id);
    if (intake === null) {
      throw new NotFoundException("Intake not found.");
    }

    if (
      intake.courseUnitOfferings.length === 0 &&
      !actor.permissions.includes(OFFERING_MANAGE_PERMISSION) &&
      !actor.permissions.includes("academic:structure:manage")
    ) {
      throw new ForbiddenException(
        "Institution-wide session-management scope is required for an empty intake.",
      );
    }
    for (const offering of intake.courseUnitOfferings) {
      await this.assertCanManageOffering(actorId, offering.id);
      this.assertOfferingSchedulable(offering);
    }
    return this.generateFor(
      intake.courseUnitOfferings,
      intake.startDate,
      intake.endDate,
      intake.id,
    );
  }

  /** Returns a student's selected-offering sessions for the week containing the given date. */
  async getStudentWeeklySchedule(studentId: string, weekContaining: Date, actorId: string) {
    const id = validateAcademicUuid(studentId, "Student ID");
    const actor = await this.getActivePermissions(actorId);
    if (!actor.permissions.includes(SESSION_ATTEND_PERMISSION)) {
      throw new ForbiddenException(`The ${SESSION_ATTEND_PERMISSION} permission is required.`);
    }
    const student = await this.repository.findStudentAttendIdentity(id);
    if (student === null || student.userId !== actorId) {
      throw new ForbiddenException("Students may only view their own weekly schedule.");
    }
    if (!(weekContaining instanceof Date) || !Number.isFinite(weekContaining.getTime())) {
      throw new BadRequestException("The schedule week must be a valid date.");
    }

    const start = this.startOfUtcWeek(weekContaining);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const registrations = await this.repository.findStudentWeek(id, start, end);
    return registrations.flatMap(({ offering }) =>
      offering.classSessions.map((session) => ({
        offeringId: offering.id,
        courseUnit: offering.courseUnit,
        session,
      })),
    );
  }

  private async generateFor(
    offerings: readonly OfferingSchedule[],
    startDate: Date,
    endDate: Date,
    intakeId: string,
  ): Promise<Awaited<ReturnType<TimetableRepository["createGeneratedSessions"]>>> {
    const holidayRangeStart = this.startOfUtcDay(startDate);
    const holidayRangeEnd = new Date(
      this.startOfUtcDay(endDate).getTime() + 24 * 60 * 60 * 1000 - 1,
    );
    const holidays = await this.repository.findHolidays(holidayRangeStart, holidayRangeEnd);
    const occurrences: GeneratedSessionInput[] = [];

    for (const offering of offerings) {
      for (const slot of offering.timetableSlots) {
        const meetingUrl = validateMeetingUrl(slot.defaultMeetingUrl, this.allowedMeetingHosts);
        for (const day of this.intakeDays(startDate, endDate)) {
          if (WEEKDAYS[day.getUTCDay()] !== slot.dayOfWeek || this.isHoliday(day, holidays)) {
            continue;
          }

          const occurrence: GeneratedSessionInput = {
            offeringId: offering.id,
            slotId: slot.id,
            startsAt: this.atSlotTime(day, slot.startTime),
            endsAt: this.atSlotTime(day, slot.endTime),
            deliveryMode: slot.deliveryMode,
            room: slot.room,
            meetingUrl,
          };
          occurrences.push(occurrence);
        }
      }
    }

    await this.assertNoGeneratedSessionClashes(occurrences, offerings);
    return this.repository.createGeneratedSessions(occurrences, intakeId);
  }

  private async assertNoGeneratedSessionClashes(
    occurrences: readonly GeneratedSessionInput[],
    offerings: readonly OfferingSchedule[],
  ): Promise<void> {
    if (occurrences.length === 0) {
      return;
    }

    const earliestStart = new Date(
      Math.min(...occurrences.map(({ startsAt }) => startsAt.getTime())),
    );
    const latestEnd = new Date(Math.max(...occurrences.map(({ endsAt }) => endsAt.getTime())));
    const existing = await this.repository.findScheduledSessionsInRange(earliestStart, latestEnd);
    const lecturersByOffering = new Map(
      offerings.map((offering) => [
        offering.id,
        offering.lecturers.map(({ lecturerId }) => lecturerId),
      ]),
    );

    for (let index = 0; index < occurrences.length; index += 1) {
      const current = occurrences[index];
      if (current === undefined) {
        continue;
      }
      const currentLecturers = lecturersByOffering.get(current.offeringId) ?? [];
      for (const scheduled of existing) {
        if (
          scheduled.slotId === current.slotId &&
          scheduled.startsAt.getTime() === current.startsAt.getTime()
        ) {
          continue;
        }
        const conflict = this.getSessionClash(
          current,
          currentLecturers,
          scheduled,
          scheduled.offering.lecturers.map(({ lecturerId }) => lecturerId),
        );
        this.throwOnSessionClash(conflict);
      }

      for (let otherIndex = index + 1; otherIndex < occurrences.length; otherIndex += 1) {
        const other = occurrences[otherIndex];
        if (other === undefined) {
          continue;
        }
        const conflict = this.getSessionClash(
          current,
          currentLecturers,
          other,
          lecturersByOffering.get(other.offeringId) ?? [],
        );
        this.throwOnSessionClash(conflict);
      }
    }
  }

  private getSessionClash(
    left: Pick<GeneratedSessionInput, "offeringId" | "startsAt" | "endsAt" | "room">,
    leftLecturers: readonly string[],
    right: {
      offeringId: string;
      startsAt: Date;
      endsAt: Date;
      room: string | null;
    },
    rightLecturers: readonly string[],
  ): { room: boolean; lecturer: boolean; offering: boolean } {
    const overlaps =
      left.startsAt.getTime() < right.endsAt.getTime() &&
      right.startsAt.getTime() < left.endsAt.getTime();
    if (!overlaps) {
      return { room: false, lecturer: false, offering: false };
    }
    return {
      room:
        left.room !== null &&
        right.room !== null &&
        left.room.toLowerCase() === right.room.toLowerCase(),
      lecturer: leftLecturers.some((lecturerId) => rightLecturers.includes(lecturerId)),
      offering: left.offeringId === right.offeringId,
    };
  }

  private throwOnSessionClash(clash: {
    room: boolean;
    lecturer: boolean;
    offering: boolean;
  }): void {
    if (clash.room) {
      throw new ConflictException("The room is already booked during this class session.");
    }
    if (clash.lecturer) {
      throw new ConflictException("An assigned lecturer is already teaching during this session.");
    }
    if (clash.offering) {
      throw new ConflictException("This offering already has a session during that time.");
    }
  }

  private async getOffering(id: string): Promise<OfferingSchedule> {
    const offering = await this.repository.findOfferingSchedule(id);
    if (offering === null) {
      throw new NotFoundException("Course-unit offering not found.");
    }
    return offering;
  }

  private normalizeSlot(input: TimetableSlotInput, offeringId: string): TimetableSlotInput {
    if (!Object.values(DayOfWeek).includes(input.dayOfWeek)) {
      throw new BadRequestException("The selected weekday is invalid.");
    }
    if (!Object.values(DeliveryMode).includes(input.deliveryMode)) {
      throw new BadRequestException("The selected delivery mode is invalid.");
    }
    this.assertTime(input.startTime, "Slot start time");
    this.assertTime(input.endTime, "Slot end time");
    if (this.timeOfDay(input.endTime) <= this.timeOfDay(input.startTime)) {
      throw new BadRequestException("A timetable slot must end after it starts on the same day.");
    }

    const room =
      input.room === undefined || input.room === null
        ? null
        : normalizeRequiredText(input.room, "Room");
    const defaultMeetingUrl = validateMeetingUrl(input.defaultMeetingUrl, this.allowedMeetingHosts);
    return {
      offeringId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room,
      deliveryMode: input.deliveryMode,
      defaultMeetingUrl,
    };
  }

  private async assertNoSlotClash(
    offeringId: string,
    input: TimetableSlotInput,
    excludedSlotId?: string,
  ): Promise<void> {
    const clashes = await this.repository.findSlotClashes(offeringId, input, excludedSlotId);
    if (clashes.some(({ offering }) => offering)) {
      throw new ConflictException("This offering already has a slot during that time.");
    }
    if (clashes.some(({ room }) => room)) {
      throw new ConflictException("The room is already booked during this timetable slot.");
    }
    if (clashes.some(({ lecturer }) => lecturer)) {
      throw new ConflictException("An assigned lecturer is already teaching during this slot.");
    }
  }

  private assertOfferingSchedulable(offering: OfferingSchedule): void {
    if (offering.status === "CANCELLED") {
      throw new ConflictException("A cancelled offering cannot be scheduled.");
    }
  }

  private async assertCanManageOffering(actorId: string, offeringId: string): Promise<void> {
    const actor = await this.getActivePermissions(actorId);
    if (!actor.permissions.includes(SESSION_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`The ${SESSION_MANAGE_PERMISSION} permission is required.`);
    }
    if (
      actor.permissions.includes(OFFERING_MANAGE_PERMISSION) ||
      actor.permissions.includes("academic:structure:manage")
    ) {
      return;
    }
    if (!(await this.repository.isLecturerAssignedToOffering(actorId, offeringId))) {
      throw new ForbiddenException("Lecturers may manage sessions only for assigned offerings.");
    }
  }

  private async getActivePermissions(actorId: string) {
    const id = validateAcademicUuid(actorId, "Actor ID");
    const actor = await this.rbac.getAuthorizationSnapshot(id);
    if (actor.permissions.length === 0) {
      throw new ForbiddenException("An active account with academic permissions is required.");
    }
    return actor;
  }

  private assertTime(value: Date, label: string): void {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new BadRequestException(`${label} must be a valid time.`);
    }
  }

  private timeOfDay(value: Date): number {
    return (
      value.getUTCHours() * 3_600_000 +
      value.getUTCMinutes() * 60_000 +
      value.getUTCSeconds() * 1_000 +
      value.getUTCMilliseconds()
    );
  }

  private intakeDays(startDate: Date, endDate: Date): Date[] {
    const current = this.startOfUtcDay(startDate);
    const last = this.startOfUtcDay(endDate);
    const days: Date[] = [];
    while (current.getTime() <= last.getTime()) {
      days.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return days;
  }

  private isHoliday(day: Date, holidays: readonly { startsAt: Date; endsAt: Date }[]): boolean {
    const start = this.startOfUtcDay(day).getTime();
    const end = start + 24 * 60 * 60 * 1000 - 1;
    return holidays.some(
      (holiday) => holiday.startsAt.getTime() <= end && holiday.endsAt.getTime() >= start,
    );
  }

  private atSlotTime(day: Date, time: Date): Date {
    return new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes(),
        time.getUTCSeconds(),
      ),
    );
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private startOfUtcWeek(value: Date): Date {
    const start = this.startOfUtcDay(value);
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    return start;
  }
}
