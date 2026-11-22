// Purpose: Define typed course-unit selection results and validation errors.
import { HttpException, HttpStatus } from "@nestjs/common";
import type {
  CourseUnitOfferingStatus,
  DeliveryMode,
  UnitRegistrationStatus,
} from "@prisma/client";

/** Machine-readable reasons a course-unit selection operation can be rejected. */
export type UnitSelectionErrorReason =
  | "STUDENT_NOT_FOUND"
  | "INTAKE_NOT_FOUND"
  | "ACTIVE_ENROLLMENT_REQUIRED"
  | "MULTIPLE_ACTIVE_ENROLLMENTS"
  | "PROGRAMME_UNAVAILABLE"
  | "INTAKE_NOT_CURRENT"
  | "SELECTION_WINDOW_CLOSED"
  | "DROP_DEADLINE_PASSED"
  | "CORE_OFFERING_MISSING"
  | "CORE_UNITS_REQUIRED"
  | "CORE_UNIT_CANNOT_DROP"
  | "OFFERING_NOT_FOUND"
  | "OFFERING_CANCELLED"
  | "UNIT_NOT_ELIGIBLE"
  | "PREREQUISITE_NOT_MET"
  | "CAPACITY_EXCEEDED"
  | "TIMETABLE_CLASH"
  | "DUPLICATE_OFFERING"
  | "UNIT_ALREADY_SELECTED"
  | "COMPLETED_UNIT_CANNOT_BE_SELECTED"
  | "ELECTIVE_RULE_MISSING"
  | "ELECTIVE_CREDIT_RULE_NOT_MET"
  | "UNIT_NOT_SELECTED"
  | "CONCURRENT_SELECTION_CHANGE";

/** Conflict response with a stable machine-readable academic-rule reason. */
export class UnitSelectionRuleError extends HttpException {
  /** Exposes the stable rule key to service callers and the HTTP exception filter. */
  constructor(
    readonly reason: UnitSelectionErrorReason,
    message: string,
    status = HttpStatus.CONFLICT,
  ) {
    super({ code: reason, message }, status);
  }
}

/** One non-secret class-session entry included with a prompted offering. */
export interface UnitSelectionSession {
  id: string;
  startsAt: Date;
  endsAt: Date;
  deliveryMode: DeliveryMode;
  room: string | null;
}

/** Lecturer assigned as the primary instructor for an offering. */
export interface UnitSelectionPrimaryLecturer {
  id: string;
  staffNumber: string;
  user: { id: string; name: string | null };
}

/** Offering information shown alongside a prompted course unit. */
export interface UnitSelectionOffering {
  id: string;
  status: CourseUnitOfferingStatus;
  capacity: number | null;
  /** Remaining seats; null means the offering has no configured capacity. */
  seatsLeft: number | null;
  courseUnit: {
    id: string;
    code: string;
    name: string;
    creditUnits: number;
  };
  primaryLecturer: UnitSelectionPrimaryLecturer | null;
  sessions: UnitSelectionSession[];
}

/** One course unit grouped by the reason it is offered to the student. */
export interface PromptedUnit {
  offering: UnitSelectionOffering;
  isRetake: boolean;
  preselected: boolean;
  currentlySelected: boolean;
}

/** Prompted units and the configured elective credit ranges for the intake slot. */
export interface PromptedUnitsResult {
  core: PromptedUnit[];
  electives: PromptedUnit[];
  retakes: PromptedUnit[];
  generalUnits: PromptedUnit[];
  electiveCreditRules: Array<{ minCredits: number; maxCredits: number }>;
}

/** Current state of a selected course-unit registration. */
export interface UnitSelectionRegistration {
  id: string;
  studentId: string;
  offeringId: string;
  intakeId: string;
  status: UnitRegistrationStatus;
  isRetake: boolean;
  selectedAt: Date;
}
