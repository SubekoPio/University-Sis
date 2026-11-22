// Purpose: Define the typed one-request student home response consumed by the dashboard.
// Used by: StudentHomePage and student home components.

/** Safe category and lifecycle values returned by the student home API. */
export type StudentHomeAnnouncementCategory =
  "GENERAL" | "ACADEMIC" | "ADMISSION" | "FINANCE" | "EXAMINATION" | "EMERGENCY";

export type StudentHomeCalendarType =
  "ACADEMIC" | "HOLIDAY" | "EXAM" | "GENERAL" | "INTAKE_MILESTONE" | "CLASS_SESSION" | "PROVIDER";

export interface StudentHomeAnnouncement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  category: StudentHomeAnnouncementCategory;
  isPinned: boolean;
  sortOrder: number;
  publishAt: string;
  expiresAt: string | null;
}

export interface StudentHomeEvent {
  id: string;
  title: string;
  description: string;
  type: StudentHomeCalendarType;
  source: "AUTHORED" | "INTAKE" | "CLASS_SESSION" | "PROVIDER";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  offeringId?: string;
  deliveryMode?: "PHYSICAL" | "ONLINE" | "HYBRID";
  room?: string | null;
  providerKey?: string;
  category?: string;
}

export interface StudentHomeCourseUnit {
  offeringId: string;
  code: string;
  name: string;
  intakeName: string;
  studentCount: number;
  lecturers: string[];
  nextSession: {
    sessionId?: string;
    startsAt: string;
    deliveryMode: "PHYSICAL" | "ONLINE" | "HYBRID";
    canAttend: boolean;
    room?: string | null;
  } | null;
  room?: string | null;
}

export interface StudentHomeView {
  userId: string;
  studentId?: string;
  profile: {
    name: string | null;
    photoUrl: string | null;
    programme: { id: string; code: string; name: string } | null;
    intake: {
      id: string;
      name: string;
      academicYearLabel: string;
      status: "UPCOMING" | "SELECTION_OPEN" | "ACTIVE" | "CLOSED";
    } | null;
    schedule: "DAY" | "EVENING" | "WEEKEND" | "DISTANCE" | null;
    studyMode: "ONLINE" | "PHYSICAL" | null;
  };
  announcements: StudentHomeAnnouncement[];
  events: StudentHomeEvent[];
  courseUnits: StudentHomeCourseUnit[];
  attendanceSummary: {
    studentId: string;
    intakeId: string;
    minimumPercent: number;
    offerings: Array<{
      offeringId: string;
      courseUnitCode: string;
      courseUnitName: string;
      heldSessions: number;
      presentSessions: number;
      percentage: number | null;
      belowMinimum: boolean;
    }>;
    overall: {
      heldSessions: number;
      presentSessions: number;
      percentage: number | null;
      belowMinimum: boolean;
    };
  } | null;
}
