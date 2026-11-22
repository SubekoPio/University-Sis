// Purpose: Define typed course-unit, curriculum, and offering service inputs.
import type {
  CourseUnitLevel,
  CourseUnitStatus,
  DeliveryMode,
  OfferingLecturerRole,
  ProgrammeCourseUnitType,
} from "@prisma/client";

/** Fields required to create a course unit and its general-unit eligibility. */
export interface CreateCourseUnitInput {
  code: string;
  name: string;
  creditUnits: number;
  level: CourseUnitLevel;
  ownerDepartmentId: string;
  status?: CourseUnitStatus;
  isGeneral?: boolean;
  openToAllFaculties?: boolean;
  eligibleFacultyIds?: string[];
}

/** Mutable catalogue fields that do not alter general-unit eligibility. */
export interface UpdateCourseUnitInput {
  code?: string;
  name?: string;
  creditUnits?: number;
  level?: CourseUnitLevel;
  ownerDepartmentId?: string;
  status?: CourseUnitStatus;
}

/** Course-unit catalogue search and filtering options. */
export interface CourseUnitListFilter {
  search?: string;
  status?: CourseUnitStatus;
  level?: CourseUnitLevel;
  ownerDepartmentId?: string;
  isGeneral?: boolean;
}

/** General-unit state and faculty eligibility configuration. */
export interface CourseUnitGeneralConfiguration {
  isGeneral: boolean;
  openToAllFaculties?: boolean;
  eligibleFacultyIds?: string[];
}

/** A course unit and its CORE or ELECTIVE curriculum classification. */
export interface CurriculumCourseUnitInput {
  courseUnitId: string;
  type: ProgrammeCourseUnitType;
}

/** An elective-credit boundary for one programme curriculum slot. */
export interface ElectiveCreditRuleInput {
  minCredits: number;
  maxCredits: number;
}

/** Delivery and capacity settings applied to newly bulk-created offerings. */
export interface BulkCreateOfferingsInput {
  deliveryMode: DeliveryMode;
  capacity?: number | null;
}

/** Fields required to create a single course-unit offering. */
export interface CreateOfferingInput extends BulkCreateOfferingsInput {
  courseUnitId: string;
  intakeId: string;
}

/** Lecturer and responsibility to assign to an offering. */
export interface AssignOfferingLecturerInput {
  lecturerId: string;
  role: OfferingLecturerRole;
}
