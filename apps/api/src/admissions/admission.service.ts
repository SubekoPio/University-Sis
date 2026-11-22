// Purpose: Admit eligible applicants and deliver temporary credentials after commit.
import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApplicationDocumentStatus,
  ApplicationFeeStatus,
  ApplicationStatus,
  Prisma,
  StudyMode,
} from "@prisma/client";
import type { AdmissionRecord } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { StudentsService } from "../academic/students.service.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import { AdmissionEligibilityError } from "./admission.errors.js";
import type { AdmissionEligibilityFailure } from "./admission.errors.js";
import { AdminUsersService } from "../users/admin-users.service.js";
import type { AdmissionStudentCredentials } from "../users/admin-users.service.js";
import type { AdmissionsApplication, PromptedCourseUnit } from "./admissions.types.js";
import { REQUIRED_APPLICATION_DOCUMENT_TYPES } from "./admissions.types.js";

const ADMISSION_PERMISSION = "admissions:admit";
/** Result of an admission, including post-commit email outcome and initial course prompts. */
export interface AdmissionResult {
  admission: AdmissionRecord;
  studentId: string;
  promptedCourseUnits: PromptedCourseUnit[];
  credentialsEmailSent: boolean;
}

/** Applies admissions separation-of-duties rules and provisions the student atomically. */
@Injectable()
export class AdmissionService {
  private readonly requiredFeeMinor: number;
  private readonly currency: string;

  /** Receives admissions persistence, account provisioning, RBAC, and fee configuration. */
  constructor(
    private readonly repository: AdmissionsRepository,
    private readonly adminUsersService: AdminUsersService,
    private readonly studentsService: StudentsService,
    private readonly rbac: RbacService,
    config: ConfigService,
  ) {
    this.requiredFeeMinor = config.getOrThrow<number>("APPLICATION_FEE_AMOUNT_MINOR");
    this.currency = config.getOrThrow<string>("CURRENCY");
  }

  /** Admits a qualified applicant, commits all academic records, then sends credentials. */
  async admit(
    applicationId: string,
    adminId: string,
    studyMode: StudyMode,
  ): Promise<AdmissionResult> {
    await this.assertAdmissionPermission(adminId);
    if (!isUUID(applicationId)) {
      throw new BadRequestException("Application ID must be a valid UUID.");
    }
    if (!Object.values(StudyMode).includes(studyMode)) {
      throw new BadRequestException("The selected study mode is invalid.");
    }

    let committed: {
      records: {
        admission: AdmissionRecord;
        studentId: string;
        promptedCourseUnits: PromptedCourseUnit[];
      };
      credentials: AdmissionStudentCredentials;
    };
    try {
      committed = await this.repository.withTransaction(async (transaction) => {
        const application = await this.repository.findApplicationForAdmission(
          applicationId,
          transaction,
        );
        if (application === null) {
          throw new NotFoundException("Active application not found.");
        }

        const failures = this.getEligibilityFailures(application);
        if (failures.length > 0) {
          throw new AdmissionEligibilityError(failures);
        }
        if (
          application.documents.some(
            (document) =>
              document.status === ApplicationDocumentStatus.APPROVED &&
              document.reviewedById === adminId,
          )
        ) {
          throw new ForbiddenException(
            "The user who approved an application document cannot admit the applicant.",
          );
        }

        const credentials = await this.adminUsersService.createStudentForAdmission(transaction, {
          email: application.email,
          name: application.applicantName,
          admittedById: adminId,
        });
        const student = await this.studentsService.createProfileForAdmission(
          transaction,
          {
            userId: credentials.user.id,
            studentNumber: `SIS-${randomUUID()}`,
            phone: application.phone,
            dateOfBirth: application.dateOfBirth,
            nationality: application.nationality,
            schedule: application.schedule,
          },
          adminId,
        );
        const records = await this.repository.createAdmissionRecords(transaction, {
          application,
          studentId: student.id,
          admittedById: adminId,
          studyMode,
          admittedAt: new Date(),
        });
        return { records, credentials };
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        throw new ConflictException(
          "The application changed or was admitted by another user; reload it and try again.",
        );
      }
      throw error;
    }

    const credentialsEmailSent = await this.adminUsersService.sendAdmissionStudentCredentials(
      committed.credentials,
      adminId,
      "created",
    );
    return { ...committed.records, credentialsEmailSent };
  }

  /** Resends fresh temporary credentials for an admitted application. */
  async resendCredentials(applicationId: string, adminId: string): Promise<boolean> {
    await this.assertAdmissionPermission(adminId);
    if (!isUUID(applicationId)) {
      throw new BadRequestException("Application ID must be a valid UUID.");
    }
    const student = await this.repository.findAdmittedStudentUser(applicationId);
    if (student === null) {
      throw new NotFoundException("Admitted application or student account not found.");
    }
    return this.adminUsersService.resendAdmissionStudentCredentials(student.id, adminId);
  }

  private async assertAdmissionPermission(adminId: string): Promise<void> {
    const status = await this.repository.findUserStatus(adminId);
    if (status !== "ACTIVE") {
      throw new ForbiddenException("An active account with admission permission is required.");
    }
    const snapshot = await this.rbac.getAuthorizationSnapshot(adminId);
    if (!snapshot.permissions.includes(ADMISSION_PERMISSION)) {
      throw new ForbiddenException(`The ${ADMISSION_PERMISSION} permission is required.`);
    }
  }

  private getEligibilityFailures(
    application: AdmissionsApplication,
  ): AdmissionEligibilityFailure[] {
    const failures: AdmissionEligibilityFailure[] = [];
    if (
      application.status === ApplicationStatus.ADMITTED ||
      application.status === ApplicationStatus.REJECTED ||
      application.status === ApplicationStatus.WITHDRAWN
    ) {
      failures.push("APPLICATION_ALREADY_FINAL");
    }

    const hasEveryRequiredDocument = REQUIRED_APPLICATION_DOCUMENT_TYPES.every((type) =>
      application.documents.some((document) => document.type === type),
    );
    if (!hasEveryRequiredDocument) {
      failures.push("REQUIRED_DOCUMENTS_MISSING");
    } else if (
      REQUIRED_APPLICATION_DOCUMENT_TYPES.some((type) =>
        application.documents.some(
          (document) =>
            document.type === type &&
            (document.status !== ApplicationDocumentStatus.APPROVED ||
              document.reviewedById === null),
        ),
      )
    ) {
      failures.push("REQUIRED_DOCUMENTS_NOT_APPROVED");
    }

    const feeConfirmed = application.feeRecords.some(
      (fee) =>
        fee.status === ApplicationFeeStatus.RECORDED &&
        fee.currency === this.currency &&
        fee.amountMinor >= this.requiredFeeMinor,
    );
    if (!feeConfirmed) {
      failures.push("APPLICATION_FEE_NOT_CONFIRMED");
    }
    return failures;
  }
}
