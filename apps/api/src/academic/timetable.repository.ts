// Purpose: Persist recurring timetable slots, generated sessions, schedules, and Attend clicks.
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { TimetableSlotInput } from "./timetable.types.js";

const slotSummarySelect = {
  id: true,
  offeringId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  deliveryMode: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TimetableSlotSelect;

const sessionSummarySelect = {
  id: true,
  offeringId: true,
  slotId: true,
  startsAt: true,
  endsAt: true,
  deliveryMode: true,
  room: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClassSessionSelect;

const offeringScheduleSelect = {
  id: true,
  intakeId: true,
  deliveryMode: true,
  status: true,
  intake: { select: { id: true, startDate: true, endDate: true } },
  lecturers: { select: { lecturerId: true } },
  timetableSlots: {
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      room: true,
      deliveryMode: true,
      defaultMeetingUrl: true,
    },
  },
} satisfies Prisma.CourseUnitOfferingSelect;

const slotClashSelect = {
  id: true,
  offeringId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  offering: {
    select: {
      intake: { select: { startDate: true, endDate: true } },
      lecturers: { select: { lecturerId: true } },
    },
  },
} satisfies Prisma.TimetableSlotSelect;

const sessionManagementSelect = {
  id: true,
  offeringId: true,
  slotId: true,
  startsAt: true,
  endsAt: true,
  deliveryMode: true,
  room: true,
  status: true,
  meetingUrl: true,
  offering: {
    select: {
      intake: { select: { startDate: true, endDate: true } },
      lecturers: { select: { lecturerId: true } },
    },
  },
} satisfies Prisma.ClassSessionSelect;

const sessionClashSelect = {
  id: true,
  offeringId: true,
  slotId: true,
  startsAt: true,
  endsAt: true,
  room: true,
  offering: { select: { lecturers: { select: { lecturerId: true } } } },
} satisfies Prisma.ClassSessionSelect;

/** Internal session fields used by management operations, including the private link. */
export type SessionManagementRecord = Prisma.ClassSessionGetPayload<{
  select: typeof sessionManagementSelect;
}>;

/** One occurrence to insert while generating sessions from recurring slots. */
export interface GeneratedSessionInput {
  offeringId: string;
  slotId: string;
  startsAt: Date;
  endsAt: Date;
  deliveryMode: "PHYSICAL" | "ONLINE" | "HYBRID";
  room: string | null;
  meetingUrl: string | null;
}

/** Prisma persistence operations for timetable slots and class-session workflows. */
@Injectable()
export class TimetableRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Loads an offering's intake window, assigned lecturers, and recurring slots. */
  findOfferingSchedule(id: string) {
    return this.prisma.courseUnitOffering.findFirst({
      where: {
        id,
        intake: {
          is: {
            deletedAt: null,
            academicYear: { is: { deletedAt: null } },
          },
        },
      },
      select: offeringScheduleSelect,
    });
  }

  /** Checks whether a user is the assigned lecturer for an offering. */
  isLecturerAssignedToOffering(userId: string, offeringId: string): Promise<boolean> {
    return this.prisma.offeringLecturer
      .findFirst({
        where: { offeringId, lecturer: { is: { userId } } },
        select: { offeringId: true },
      })
      .then((assignment) => assignment !== null);
  }

  /** Loads the active offerings and all recurring slots for an intake. */
  findIntakeSchedule(id: string) {
    return this.prisma.intake.findFirst({
      where: {
        id,
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        courseUnitOfferings: {
          where: { status: { not: "CANCELLED" } },
          select: offeringScheduleSelect,
        },
      },
    });
  }

  /** Loads holiday date ranges that overlap an intake. */
  findHolidays(startDate: Date, endDate: Date) {
    return this.prisma.calendarEvent.findMany({
      where: {
        type: "HOLIDAY",
        startsAt: { lte: endDate },
        endsAt: { gte: startDate },
      },
      select: { startsAt: true, endsAt: true },
    });
  }

  /** Returns recurring slot conflicts caused by a room or shared lecturer. */
  async findSlotClashes(
    offeringId: string,
    input: Pick<TimetableSlotInput, "dayOfWeek" | "startTime" | "endTime" | "room">,
    excludedSlotId?: string,
  ): Promise<{ room: boolean; lecturer: boolean; offering: boolean }[]> {
    const target = await this.findOfferingSchedule(offeringId);
    if (target === null) {
      return [];
    }

    const lecturerIds = target.lecturers.map(({ lecturerId }) => lecturerId);
    const or: Prisma.TimetableSlotWhereInput[] = [{ offeringId }];
    if (input.room !== null && input.room !== undefined) {
      or.push({ room: { equals: input.room, mode: "insensitive" } });
    }
    if (lecturerIds.length > 0) {
      or.push({
        offering: {
          is: { lecturers: { some: { lecturerId: { in: lecturerIds } } } },
        },
      });
    }

    const candidates = await this.prisma.timetableSlot.findMany({
      where: {
        ...(excludedSlotId === undefined ? {} : { id: { not: excludedSlotId } }),
        OR: or,
      },
      select: slotClashSelect,
    });
    const proposedStart = this.timeOfDay(input.startTime);
    const proposedEnd = this.timeOfDay(input.endTime);

    return candidates.flatMap((candidate) => {
      const intakeOverlaps =
        target.intake.startDate.getTime() <= candidate.offering.intake.endDate.getTime() &&
        candidate.offering.intake.startDate.getTime() <= target.intake.endDate.getTime();
      const timeOverlaps =
        input.dayOfWeek === candidate.dayOfWeek &&
        proposedStart < this.timeOfDay(candidate.endTime) &&
        this.timeOfDay(candidate.startTime) < proposedEnd;
      if (!intakeOverlaps || !timeOverlaps) {
        return [];
      }

      const room =
        input.room !== null &&
        input.room !== undefined &&
        candidate.room !== null &&
        input.room.toLowerCase() === candidate.room.toLowerCase();
      const lecturer = candidate.offering.lecturers.some(({ lecturerId }) =>
        lecturerIds.includes(lecturerId),
      );
      const offeringClash = candidate.offeringId === offeringId;
      return room || lecturer || offeringClash ? [{ room, lecturer, offering: offeringClash }] : [];
    });
  }

  /** Returns the requested recurring slot without including its default meeting URL. */
  findSlot(id: string) {
    return this.prisma.timetableSlot.findUnique({
      where: { id },
      select: {
        ...slotSummarySelect,
        offering: {
          select: {
            id: true,
            intake: { select: { startDate: true, endDate: true } },
            lecturers: { select: { lecturerId: true } },
          },
        },
      },
    });
  }

  /** Creates a recurring slot and excludes its default meeting URL from the result. */
  createSlot(input: TimetableSlotInput) {
    return this.prisma.timetableSlot.create({
      data: input,
      select: slotSummarySelect,
    });
  }

  /** Lists an offering's recurring slots without selecting default meeting URLs. */
  listSlotsForOffering(offeringId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { offeringId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { id: "asc" }],
      select: slotSummarySelect,
    });
  }

  /** Updates a recurring slot without changing its offering or exposing its link. */
  updateSlot(id: string, input: Omit<TimetableSlotInput, "offeringId">) {
    return this.prisma.timetableSlot.update({
      where: { id },
      data: input,
      select: slotSummarySelect,
    });
  }

  /** Deletes one recurring slot; generated class sessions remain as dated history. */
  async deleteSlot(id: string): Promise<boolean> {
    const result = await this.prisma.timetableSlot.deleteMany({ where: { id } });
    return result.count === 1;
  }

  /** Checks an overlapping scheduled session for room or lecturer conflicts. */
  async hasSessionClash(input: {
    offeringId: string;
    startsAt: Date;
    endsAt: Date;
    room: string | null;
    lecturerIds: string[];
    slotId?: string;
    excludedSessionId?: string;
  }): Promise<boolean> {
    const or: Prisma.ClassSessionWhereInput[] = [{ offeringId: input.offeringId }];
    if (input.room !== null) {
      or.push({ room: { equals: input.room, mode: "insensitive" } });
    }
    if (input.lecturerIds.length > 0) {
      or.push({
        offering: {
          is: { lecturers: { some: { lecturerId: { in: input.lecturerIds } } } },
        },
      });
    }
    const conflict = await this.prisma.classSession.findFirst({
      where: {
        status: "SCHEDULED",
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
        ...(input.excludedSessionId === undefined ? {} : { id: { not: input.excludedSessionId } }),
        ...(input.slotId === undefined
          ? {}
          : { NOT: { slotId: input.slotId, startsAt: input.startsAt } }),
        OR: or,
      },
      select: { id: true },
    });
    return conflict !== null;
  }

  /** Creates missing occurrences idempotently and serializes generation for each intake. */
  createGeneratedSessions(
    input: GeneratedSessionInput[],
    intakeId: string,
  ): Promise<Prisma.ClassSessionGetPayload<{ select: typeof sessionSummarySelect }>[]> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Intake" WHERE "id" = ${intakeId}::uuid FOR UPDATE
      `;
      if (input.length === 0) {
        return [];
      }

      const slotIds = [...new Set(input.map(({ slotId }) => slotId))];
      const starts = input.map(({ startsAt }) => startsAt.getTime());
      const minStart = new Date(Math.min(...starts));
      const maxStart = new Date(Math.max(...starts));
      const existing = await transaction.classSession.findMany({
        where: {
          slotId: { in: slotIds },
          startsAt: { gte: minStart, lte: maxStart },
        },
        select: sessionSummarySelect,
      });
      const existingKeys = new Set(
        existing.map(({ slotId, startsAt }) => this.sessionKey(slotId, startsAt)),
      );
      const missing = new Map<string, GeneratedSessionInput>();
      for (const occurrence of input) {
        const key = this.sessionKey(occurrence.slotId, occurrence.startsAt);
        if (!existingKeys.has(key)) {
          missing.set(key, occurrence);
        }
      }
      if (missing.size > 0) {
        await transaction.classSession.createMany({
          data: [...missing.values()].map((occurrence) => ({
            ...occurrence,
            meetingProvider: "manual",
          })),
        });
      }

      const persisted = await transaction.classSession.findMany({
        where: {
          slotId: { in: slotIds },
          startsAt: { gte: minStart, lte: maxStart },
        },
        select: sessionSummarySelect,
      });
      const byKey = new Map(
        persisted.map((session) => [this.sessionKey(session.slotId, session.startsAt), session]),
      );
      return input.map((occurrence) => {
        const session = byKey.get(this.sessionKey(occurrence.slotId, occurrence.startsAt));
        if (session === undefined) {
          throw new Error("A generated class session was not persisted.");
        }
        return session;
      });
    });
  }

  /** Loads scheduled sessions overlapping a proposed generation range without link fields. */
  findScheduledSessionsInRange(startsAt: Date, endsAt: Date) {
    return this.prisma.classSession.findMany({
      where: {
        status: "SCHEDULED",
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: sessionClashSelect,
    });
  }

  /** Lists selected-course-unit sessions for a week without selecting link fields. */
  findStudentWeek(studentId: string, start: Date, end: Date) {
    return this.prisma.unitRegistration.findMany({
      where: {
        studentId,
        status: "SELECTED",
        offering: {
          is: {
            classSessions: {
              some: {
                status: { not: "CANCELLED" },
                startsAt: { gte: start, lt: end },
              },
            },
          },
        },
      },
      select: {
        offering: {
          select: {
            id: true,
            courseUnit: { select: { code: true, name: true } },
            classSessions: {
              where: {
                status: { not: "CANCELLED" },
                startsAt: { gte: start, lt: end },
              },
              orderBy: { startsAt: "asc" },
              select: sessionSummarySelect,
            },
          },
        },
      },
      orderBy: { selectedAt: "asc" },
    });
  }

  /** Resolves a session's management fields without exposing them from service results. */
  findSessionForManagement(id: string): Promise<SessionManagementRecord | null> {
    return this.prisma.classSession.findUnique({
      where: { id },
      select: sessionManagementSelect,
    });
  }

  /** Replaces a session link while returning only non-secret session fields. */
  async setMeetingLink(
    id: string,
    meetingUrl: string,
  ): Promise<Prisma.ClassSessionGetPayload<{ select: typeof sessionSummarySelect }> | null> {
    const result = await this.prisma.classSession.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { meetingUrl, meetingProvider: "manual" },
    });
    if (result.count !== 1) {
      return null;
    }
    return this.prisma.classSession.findUnique({
      where: { id },
      select: sessionSummarySelect,
    });
  }

  /** Cancels only a scheduled session and returns its safe summary. */
  async cancelSession(id: string) {
    const result = await this.prisma.classSession.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    if (result.count !== 1) {
      return null;
    }
    return this.prisma.classSession.findUnique({
      where: { id },
      select: sessionSummarySelect,
    });
  }

  /** Reschedules only a scheduled session and returns its safe summary. */
  async rescheduleSession(
    id: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<Prisma.ClassSessionGetPayload<{ select: typeof sessionSummarySelect }> | null> {
    const result = await this.prisma.classSession.updateMany({
      where: { id, status: "SCHEDULED" },
      data: { startsAt, endsAt },
    });
    if (result.count !== 1) {
      return null;
    }
    return this.prisma.classSession.findUnique({
      where: { id },
      select: sessionSummarySelect,
    });
  }

  /** Finds an active student's user identity and their most recent admitted study mode. */
  findStudentAttendIdentity(studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, user: { is: { status: "ACTIVE" } } },
      select: {
        id: true,
        userId: true,
        admissionRecords: {
          orderBy: [{ admittedAt: "desc" }, { id: "asc" }],
          take: 1,
          select: { studyMode: true },
        },
      },
    });
  }

  /** Loads the session and selected-registration state required by Attend. */
  findAttendSession(sessionId: string, studentId: string) {
    return this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        deliveryMode: true,
        meetingUrl: true,
        offering: {
          select: {
            id: true,
            deliveryMode: true,
            registrations: {
              where: { studentId, status: "SELECTED" },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
  }

  /** Persists one immutable Attend click at the supplied time. */
  createSessionJoin(
    studentId: string,
    sessionId: string,
    clickedAt: Date,
  ): Promise<{ id: string }> {
    return this.prisma.sessionJoin.create({
      data: { studentId, sessionId, clickedAt },
      select: { id: true },
    });
  }

  private timeOfDay(value: Date): number {
    return (
      value.getUTCHours() * 3_600_000 +
      value.getUTCMinutes() * 60_000 +
      value.getUTCSeconds() * 1_000 +
      value.getUTCMilliseconds()
    );
  }

  private sessionKey(slotId: string | null, startsAt: Date): string {
    return `${slotId ?? "manual"}:${startsAt.getTime()}`;
  }
}
