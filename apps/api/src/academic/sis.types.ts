// Purpose: Define typed contracts for student, enrollment, and lecturer services.
import type { StudentSchedule, StudyMode } from "@prisma/client";

/** Details copied from an admitted application when its student profile is created. */
export interface CreateStudentProfileForAdmissionInput {
  userId: string;
  studentNumber: string;
  phone: string;
  dateOfBirth: Date;
  nationality: string;
  schedule: StudentSchedule;
}

/** Mutable student-profile fields; schedule is intentionally not changed here. */
export interface UpdateStudentInput {
  studentNumber?: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  nationality?: string | null;
  nationalId?: string | null;
  address?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelationship?: string | null;
}

/** Search and pagination filters for student profiles. */
export interface StudentListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Paginated student profiles and the total matching count. */
export interface StudentPage<TStudent> {
  students: TStudent[];
  total: number;
  page: number;
  pageSize: number;
}

/** Changes the study mode recorded for an admitted application. */
export interface ChangeStudyModeInput {
  applicationId: string;
  studyMode: StudyMode;
  reason: string;
}

/** Fields used to link an existing account to a lecturer profile. */
export interface CreateLecturerInput {
  userId: string;
  departmentId: string;
  staffNumber: string;
}

/** Mutable lecturer profile fields. */
export interface UpdateLecturerInput {
  departmentId?: string;
  staffNumber?: string;
}

/** Filters for lecturer lookup. */
export interface LecturerListFilters {
  departmentId?: string;
  search?: string;
}

/** Status and progression position of an enrollment. */
export interface EnrollmentTransitionInput {
  enrollmentId: string;
  actorId: string;
  reason?: string;
}
