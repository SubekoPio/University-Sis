// Purpose: Define typed input contracts for academic-structure services and repositories.
import type { AwardLevel, IntakeStatus } from "@prisma/client";

/** Fields required to create a faculty. */
export interface CreateFacultyInput {
  code: string;
  name: string;
}

/** Mutable faculty fields. */
export interface UpdateFacultyInput {
  code?: string;
  name?: string;
}

/** Fields required to create a department. */
export interface CreateDepartmentInput {
  facultyId: string;
  code: string;
  name: string;
}

/** Mutable department fields. */
export interface UpdateDepartmentInput {
  facultyId?: string;
  code?: string;
  name?: string;
}

/** Fields required to create a programme. */
export interface CreateProgrammeInput {
  departmentId: string;
  code: string;
  name: string;
  awardLevel: AwardLevel;
  durationYears: number;
}

/** Mutable programme fields. */
export interface UpdateProgrammeInput {
  departmentId?: string;
  code?: string;
  name?: string;
  awardLevel?: AwardLevel;
  durationYears?: number;
}

/** Configurable dates and name for one of an academic year's three intakes. */
export interface CreateIntakeInput {
  sequence: number;
  name: string;
  startDate: Date;
  endDate: Date;
  selectionOpensAt: Date;
  selectionClosesAt: Date;
}

/** Fields required to create an academic year and its three intakes atomically. */
export interface CreateAcademicYearInput {
  label: string;
  startDate: Date;
  endDate: Date;
  intakes: CreateIntakeInput[];
}

/** Mutable academic-year fields. */
export interface UpdateAcademicYearInput {
  label?: string;
  startDate?: Date;
  endDate?: Date;
}

/** Mutable intake fields; lifecycle status changes use a separate transition method. */
export interface UpdateIntakeInput {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  selectionOpensAt?: Date;
  selectionClosesAt?: Date;
}

/** Filter for listing departments by their parent faculty. */
export interface DepartmentListFilter {
  facultyId?: string;
}

/** Filter for listing programmes by their parent department. */
export interface ProgrammeListFilter {
  departmentId?: string;
}

/** Requested next state in the intake lifecycle. */
export type IntakeStatusTransition = IntakeStatus;
