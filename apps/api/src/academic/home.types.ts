// Purpose: Define one-call home response shapes for student, lecturer, and registrar views.
import { z } from "zod";
import type { DeliveryMode, IntakeStatus, StudentSchedule, StudyMode } from "@prisma/client";
import type { AnnouncementView } from "./announcements.types.js";
import type { CalendarEventItem } from "./calendar.types.js";
import type { StudentAttendanceSummary } from "./attendance.types.js";

const announcementViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().url().nullable(),
  category: z.enum(["GENERAL", "ACADEMIC", "FINANCE", "EXAM", "EVENT"]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  isPinned: z.boolean(),
  sortOrder: z.number().int(),
  publishAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  audiences: z.array(
    z.object({
      audienceType: z.enum([
        "ALL_STUDENTS",
        "ALL_LECTURERS",
        "ROLE",
        "FACULTY",
        "PROGRAMME",
        "INTAKE",
        "COURSE_UNIT_OFFERING",
      ]),
      targetId: z.string().nullable(),
    }),
  ),
});

const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["HOLIDAY", "ACADEMIC", "EVENT", "INTAKE_MILESTONE", "CLASS_SESSION", "PROVIDER"]),
  source: z.enum(["AUTHORED", "INTAKE", "CLASS_SESSION", "PROVIDER"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean(),
  offeringId: z.string().optional(),
  deliveryMode: z.enum(["PHYSICAL", "ONLINE", "HYBRID"]).optional(),
  room: z.string().nullable().optional(),
  providerKey: z.string().optional(),
  category: z.string().optional(),
});

const percentageSchema = z.object({
  heldSessions: z.number().int().nonnegative(),
  presentSessions: z.number().int().nonnegative(),
  percentage: z.number().nullable(),
  belowMinimum: z.boolean(),
});

const attendanceSummarySchema = z.object({
  studentId: z.string(),
  intakeId: z.string(),
  minimumPercent: z.number(),
  offerings: z.array(
    percentageSchema.extend({
      offeringId: z.string(),
      courseUnitCode: z.string(),
      courseUnitName: z.string(),
    }),
  ),
  overall: percentageSchema,
});

const courseUnitSchema = z.object({
  offeringId: z.string(),
  code: z.string(),
  name: z.string(),
  intakeName: z.string(),
  studentCount: z.number().int().nonnegative(),
});

const classSessionSchema = z.object({
  sessionId: z.string(),
  offeringId: z.string(),
  courseUnitCode: z.string(),
  courseUnitName: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  deliveryMode: z.enum(["PHYSICAL", "ONLINE", "HYBRID"]),
  room: z.string().nullable(),
});

const studentHomeSchema: z.ZodType<StudentHomeView> = z.object({
  userId: z.string(),
  profile: z.object({
    name: z.string().nullable(),
    photoUrl: z.string().url().nullable(),
    programme: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
    intake: z
      .object({
        id: z.string(),
        name: z.string(),
        academicYearLabel: z.string(),
        status: z.enum(["UPCOMING", "SELECTION_OPEN", "ACTIVE", "CLOSED"]),
      })
      .nullable(),
    schedule: z.enum(["DAY", "EVENING", "WEEKEND", "DISTANCE"]).nullable(),
    studyMode: z.enum(["ONLINE", "PHYSICAL"]).nullable(),
  }),
  announcements: z.array(announcementViewSchema).max(5),
  events: z.array(calendarEventSchema),
  courseUnits: z.array(
    courseUnitSchema.extend({
      lecturers: z.array(z.string()),
      nextSession: z
        .object({
          startsAt: z.coerce.date(),
          deliveryMode: z.enum(["PHYSICAL", "ONLINE", "HYBRID"]),
          canAttend: z.boolean(),
        })
        .nullable(),
    }),
  ),
  attendanceSummary: attendanceSummarySchema.nullable(),
});

const lecturerHomeSchema: z.ZodType<LecturerHomeView> = z.object({
  userId: z.string(),
  announcements: z.array(announcementViewSchema).max(5),
  events: z.array(calendarEventSchema),
  courseUnits: z.array(courseUnitSchema),
  todaysClasses: z.array(classSessionSchema),
});

const registrarHomeSchema: z.ZodType<RegistrarHomeView> = z.object({
  userId: z.string(),
  announcements: z.array(announcementViewSchema).max(5),
  events: z.array(calendarEventSchema),
  currentIntake: z
    .object({
      id: z.string(),
      name: z.string(),
      academicYearLabel: z.string(),
      status: z.enum(["UPCOMING", "SELECTION_OPEN", "ACTIVE", "CLOSED"]),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      selectionOpensAt: z.coerce.date(),
      selectionClosesAt: z.coerce.date(),
    })
    .nullable(),
  selectionProgress: z.object({
    registeredStudents: z.number().int().nonnegative(),
    studentsWithSelections: z.number().int().nonnegative(),
    percent: z.number().nullable(),
  }),
  needsAttention: z.object({
    offeringsWithoutLecturersCount: z.number().int().nonnegative(),
    offeringsWithoutLecturers: z.array(
      z.object({ offeringId: z.string(), code: z.string(), name: z.string() }),
    ),
    admittedStudentsWithoutSelectionsCount: z.number().int().nonnegative(),
    admittedStudentsWithoutSelections: z.array(
      z.object({ studentId: z.string(), name: z.string().nullable(), studentNumber: z.string() }),
    ),
  }),
});

/** Aggregated student home view; photo and meeting links are never persisted here. */
export interface StudentHomeView {
  userId: string;
  profile: {
    name: string | null;
    photoUrl: string | null;
    programme: { id: string; code: string; name: string } | null;
    intake: {
      id: string;
      name: string;
      academicYearLabel: string;
      status: IntakeStatus;
    } | null;
    schedule: StudentSchedule | null;
    studyMode: StudyMode | null;
  };
  announcements: AnnouncementView[];
  events: CalendarEventItem[];
  courseUnits: Array<{
    offeringId: string;
    code: string;
    name: string;
    intakeName: string;
    studentCount: number;
    lecturers: string[];
    nextSession: {
      startsAt: Date;
      deliveryMode: DeliveryMode;
      canAttend: boolean;
    } | null;
  }>;
  attendanceSummary: StudentAttendanceSummary | null;
}

/** Aggregated lecturer view with current intake teaching load and today's classes. */
export interface LecturerHomeView {
  userId: string;
  announcements: AnnouncementView[];
  events: CalendarEventItem[];
  courseUnits: Array<{
    offeringId: string;
    code: string;
    name: string;
    intakeName: string;
    studentCount: number;
  }>;
  todaysClasses: Array<{
    sessionId: string;
    offeringId: string;
    courseUnitCode: string;
    courseUnitName: string;
    startsAt: Date;
    endsAt: Date;
    deliveryMode: DeliveryMode;
    room: string | null;
  }>;
}

/** Aggregated registrar view with selection progress and attention queues. */
export interface RegistrarHomeView {
  userId: string;
  announcements: AnnouncementView[];
  events: CalendarEventItem[];
  currentIntake: {
    id: string;
    name: string;
    academicYearLabel: string;
    status: IntakeStatus;
    startDate: Date;
    endDate: Date;
    selectionOpensAt: Date;
    selectionClosesAt: Date;
  } | null;
  selectionProgress: {
    registeredStudents: number;
    studentsWithSelections: number;
    percent: number | null;
  };
  needsAttention: {
    offeringsWithoutLecturersCount: number;
    offeringsWithoutLecturers: Array<{ offeringId: string; code: string; name: string }>;
    admittedStudentsWithoutSelectionsCount: number;
    admittedStudentsWithoutSelections: Array<{
      studentId: string;
      name: string | null;
      studentNumber: string;
    }>;
  };
}

/** Runtime schemas used to validate serialized Redis values before reuse. */
export const homeCacheSchemas = {
  student: studentHomeSchema,
  lecturer: lecturerHomeSchema,
  registrar: registrarHomeSchema,
};
