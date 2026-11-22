// Purpose: Define safe timetable and meeting-provider contracts for academic services.
import type { DayOfWeek, DeliveryMode } from "@prisma/client";

/** Nest token used to bind a meeting-provider adapter. */
export const MEETING_PROVIDER = Symbol("MEETING_PROVIDER");

/** Input used to create or update a recurring timetable slot. */
export interface TimetableSlotInput {
  offeringId: string;
  dayOfWeek: DayOfWeek;
  startTime: Date;
  endTime: Date;
  room?: string | null;
  deliveryMode: DeliveryMode;
  defaultMeetingUrl?: string | null;
}

/** Session fields safe to return from timetable and session operations. */
export interface ClassSessionSummary {
  id: string;
  offeringId: string;
  slotId: string | null;
  startsAt: Date;
  endsAt: Date;
  deliveryMode: DeliveryMode;
  room: string | null;
  status: "SCHEDULED" | "HELD" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
}

/** Recurring timetable-slot fields safe to return to callers. */
export interface TimetableSlotSummary {
  id: string;
  offeringId: string;
  dayOfWeek: DayOfWeek;
  startTime: Date;
  endTime: Date;
  room: string | null;
  deliveryMode: DeliveryMode;
  createdAt: Date;
  updatedAt: Date;
}

/** Provider request needed to generate a student's meeting join URL. */
export interface MeetingJoinRequest {
  sessionId: string;
  studentId: string;
  storedMeetingUrl: string | null;
}

/** One normalized presence interval returned by a meeting provider. */
export interface MeetingPresence {
  studentId: string;
  joinedAt: Date;
  leftAt: Date;
}

/** Adapter contract for issuing meeting links and, optionally, reading presence. */
export interface MeetingProvider {
  /** Resolves the session's join URL for a student. */
  getJoinUrl(request: MeetingJoinRequest): Promise<string>;

  /** Retrieves provider presence intervals when the selected provider supports them. */
  fetchPresence?(sessionId: string): Promise<MeetingPresence[]>;
}

/** Result of an Attend action; meeting URLs are returned only by this operation. */
export interface AttendResult {
  meetingUrl: string;
}
