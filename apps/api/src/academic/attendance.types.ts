// Purpose: Define attendance ingestion, computation, and summary contracts.
import type {
  AttendanceMethod,
  AttendanceRule,
  AttendanceStatus,
  DeliveryMode,
} from "@prisma/client";
import type { PresenceIntervalInput } from "./attendance.presence.js";

/** One normalized presence interval to ingest for a roster student. */
export interface AttendancePresenceEvent extends PresenceIntervalInput {
  studentId: string;
}

/** One attendance outcome to calculate or mark for a student. */
export interface AttendanceOutcomeInput {
  studentId: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  longestContinuousSeconds: number;
  totalSeconds: number;
}

/** One roster student's intervals in a session calculation snapshot. */
export interface StudentPresenceSnapshot {
  studentId: string;
  intervals: PresenceIntervalInput[];
}

/** Persisted session state supplied to the attendance calculation callback. */
export interface SessionAttendanceSnapshot {
  session: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    deliveryMode: DeliveryMode;
    status: "SCHEDULED" | "HELD" | "CANCELLED";
  };
  rule: AttendanceRule | null;
  students: StudentPresenceSnapshot[];
}

/** Calculates session outcomes from a transaction-consistent attendance snapshot. */
export type AttendanceCalculator = (
  snapshot: SessionAttendanceSnapshot,
) => AttendanceOutcomeInput[];

/** One valid CSV row that could not be matched to a selected student. */
export interface UnmatchedPresenceRow extends PresenceIntervalInput {
  rowNumber: number;
  email: string;
}

/** Per-offering and overall intake attendance percentages for one student. */
export interface StudentAttendanceSummary {
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
}
