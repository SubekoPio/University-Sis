// Purpose: Define shared admissions service inputs and safe result shapes.
import type {
  ApplicationDocumentType,
  ApplicationSource,
  ApplicationStatus,
  Prisma,
  StudentSchedule,
  StudyMode,
} from "@prisma/client";

/** Document categories required before an application may enter the approved state. */
export const REQUIRED_APPLICATION_DOCUMENT_TYPES: readonly ApplicationDocumentType[] = [
  "ID",
  "TRANSCRIPT",
  "CERTIFICATE",
  "PHOTO",
];

/** Metadata for an uploaded supporting document; file contents remain in object storage. */
export interface ApplicationDocumentInput {
  type: ApplicationDocumentType;
  storageKey: string;
}

/** Applicant details used by the staff and secured website intake workflows. */
export interface CreateApplicationInput {
  applicantName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  nationality: string;
  studyMode: StudyMode;
  schedule: StudentSchedule;
  desiredProgrammeId: string;
  desiredIntakeId: string;
  documents?: ApplicationDocumentInput[];
  externalRef?: string;
}

/** Applicant fields that staff may correct before admission or withdrawal. */
export type UpdateApplicationInput = Partial<
  Pick<
    CreateApplicationInput,
    | "applicantName"
    | "email"
    | "phone"
    | "dateOfBirth"
    | "nationality"
    | "studyMode"
    | "schedule"
    | "desiredProgrammeId"
    | "desiredIntakeId"
  >
>;

/** Application fields and records needed to enforce workflow transitions. */
export type AdmissionsApplication = Prisma.ApplicationGetPayload<{
  include: {
    documents: true;
    feeRecords: true;
    desiredIntake: { select: { id: true; sequence: true } };
  };
}>;

/** Course unit made available from the admitted student's current curriculum slot. */
export interface PromptedCourseUnit {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: "CORE" | "ELECTIVE";
}

/** Safe integration response for an idempotently received website application. */
export interface WebsiteApplicationResult {
  id: string;
  externalRef: string | null;
  status: ApplicationStatus;
  source: ApplicationSource;
}

/** Review result for one application document. */
export interface DocumentReviewResult {
  id: string;
  applicationId: string;
  status: "APPROVED" | "REJECTED";
  reviewerNote: string;
  applicationStatus: ApplicationStatus;
}
