// Purpose: Persist admissions workflows and their audit records using Prisma.
import { Injectable } from "@nestjs/common";
import {
  ApplicationDocumentStatus,
  ApplicationFeeStatus,
  ApplicationSource,
  ApplicationStatus,
  IntakeRegistrationStatus,
  Prisma,
  ProgrammeEnrollmentStatus,
  UserStatus,
} from "@prisma/client";
import type {
  Application,
  ApplicationDocument,
  ApplicationFeeRecord,
  AdmissionRecord,
  User,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type {
  AdmissionsApplication,
  CreateApplicationInput,
  PromptedCourseUnit,
  UpdateApplicationInput,
} from "./admissions.types.js";

const admissionsApplicationInclude = {
  documents: true,
  feeRecords: true,
  desiredIntake: { select: { id: true, sequence: true } },
} satisfies Prisma.ApplicationInclude;

/** Database operations shared by admissions workflow services. */
@Injectable()
export class AdmissionsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Runs a workflow callback in one database transaction. */
  withTransaction<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /** Finds an application by ID with the records needed for admissions rules. */
  findApplication(id: string): Promise<AdmissionsApplication | null> {
    return this.prisma.application.findUnique({
      where: { id },
      include: admissionsApplicationInclude,
    });
  }

  /** Finds a website application by its idempotency reference. */
  findWebsiteApplication(externalRef: string): Promise<Application | null> {
    return this.prisma.application.findUnique({ where: { externalRef } });
  }

  /** Checks that a programme and intake remain active before application creation or update. */
  async hasActiveProgrammeAndIntake(
    programmeId: string,
    intakeId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = transaction ?? this.prisma;
    const [programme, intake] = await Promise.all([
      client.programme.findFirst({
        where: {
          id: programmeId,
          deletedAt: null,
          department: {
            is: { deletedAt: null, faculty: { is: { deletedAt: null } } },
          },
        },
        select: { id: true },
      }),
      client.intake.findFirst({
        where: {
          id: intakeId,
          deletedAt: null,
          academicYear: { is: { deletedAt: null } },
        },
        select: { id: true },
      }),
    ]);

    return programme !== null && intake !== null;
  }

  /** Creates an office or website application and its supplied document metadata atomically. */
  createApplication(
    input: CreateApplicationInput,
    source: ApplicationSource,
    enteredById: string | null,
  ): Promise<Application> {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.application.create({
        data: {
          applicantName: input.applicantName,
          email: input.email,
          phone: input.phone,
          dateOfBirth: input.dateOfBirth,
          nationality: input.nationality,
          studyMode: input.studyMode,
          schedule: input.schedule,
          desiredProgrammeId: input.desiredProgrammeId,
          desiredIntakeId: input.desiredIntakeId,
          source,
          enteredById,
          ...(input.externalRef === undefined ? {} : { externalRef: input.externalRef }),
          ...(input.documents === undefined || input.documents.length === 0
            ? {}
            : {
                documents: {
                  create: input.documents.map(({ type, storageKey }) => ({
                    type,
                    storageKey,
                  })),
                },
              }),
        },
      });
      await this.writeAudit(transaction, {
        actorId: enteredById,
        action:
          source === "WEBSITE"
            ? "admissions.application.website_received"
            : "admissions.application.office_created",
        resourceType: "application",
        resourceId: application.id,
        metadata: { source },
      });
      return application;
    });
  }

  /** Finds an application within an existing transaction. */
  findApplicationInTransaction(
    id: string,
    transaction: Prisma.TransactionClient,
  ): Promise<AdmissionsApplication | null> {
    return transaction.application.findUnique({
      where: { id },
      include: admissionsApplicationInclude,
    });
  }

  /** Updates an application only while it is not in a final lifecycle state. */
  async updateMutableApplication(
    id: string,
    input: UpdateApplicationInput,
    transaction: Prisma.TransactionClient,
  ): Promise<Application | null> {
    const updated = await transaction.application.updateMany({
      where: {
        id,
        status: {
          notIn: [
            ApplicationStatus.ADMITTED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
          ],
        },
      },
      data: input,
    });
    return updated.count === 0 ? null : transaction.application.findUnique({ where: { id } });
  }

  /** Withdraws an application only while it is not already final. */
  async withdrawMutableApplication(
    id: string,
    transaction: Prisma.TransactionClient,
  ): Promise<Application | null> {
    const updated = await transaction.application.updateMany({
      where: {
        id,
        status: {
          notIn: [
            ApplicationStatus.ADMITTED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
          ],
        },
      },
      data: { status: ApplicationStatus.WITHDRAWN },
    });
    return updated.count === 0 ? null : transaction.application.findUnique({ where: { id } });
  }

  /** Writes an append-only audit record in the caller's transaction. */
  writeAudit(
    transaction: Prisma.TransactionClient,
    input: {
      actorId: string | null;
      action: string;
      resourceType: string;
      resourceId: string;
      reason?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    return transaction.auditLog.create({ data: input }).then(() => undefined);
  }

  /** Updates application status within a workflow transaction. */
  updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    transaction: Prisma.TransactionClient,
  ): Promise<Application> {
    return transaction.application.update({ where: { id }, data: { status } });
  }

  /** Finds an application owning the requested document. */
  findDocumentForReview(
    documentId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<(ApplicationDocument & { application: Application }) | null> {
    return transaction.applicationDocument.findUnique({
      where: { id: documentId },
      include: { application: true },
    });
  }

  /** Saves a document review decision in the caller's transaction. */
  updateDocumentReview(
    documentId: string,
    reviewerId: string,
    status: ApplicationDocumentStatus,
    note: string,
    reviewedAt: Date,
    transaction: Prisma.TransactionClient,
  ): Promise<ApplicationDocument> {
    return transaction.applicationDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewerNote: note,
        reviewedById: reviewerId,
        reviewedAt,
      },
    });
  }

  /** Lists document states after a review decision. */
  listApplicationDocuments(
    applicationId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<ApplicationDocument[]> {
    return transaction.applicationDocument.findMany({
      where: { applicationId },
    });
  }

  /** Creates a physical bank-deposit record in the caller's transaction. */
  createApplicationFee(
    input: {
      applicationId: string;
      amountMinor: number;
      currency: string;
      bankName: string;
      bankReference: string;
      depositDate: Date;
      recordedById: string;
    },
    transaction: Prisma.TransactionClient,
  ): Promise<ApplicationFeeRecord> {
    return transaction.applicationFeeRecord.create({ data: input });
  }

  /** Finds a fee record and its application for validation and recalculation. */
  findFeeRecord(
    feeRecordId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<(ApplicationFeeRecord & { application: Application }) | null> {
    return transaction.applicationFeeRecord.findUnique({
      where: { id: feeRecordId },
      include: { application: true },
    });
  }

  /** Finds an application within the fee-record transaction. */
  findApplicationForFee(
    id: string,
    transaction: Prisma.TransactionClient,
  ): Promise<Application | null> {
    return transaction.application.findUnique({ where: { id } });
  }

  /** Voids a fee record without deleting its deposit history. */
  voidApplicationFee(
    feeRecordId: string,
    voidedById: string,
    voidReason: string,
    voidedAt: Date,
    transaction: Prisma.TransactionClient,
  ): Promise<ApplicationFeeRecord | null> {
    return transaction.applicationFeeRecord
      .updateMany({
        where: { id: feeRecordId, status: ApplicationFeeStatus.RECORDED },
        data: {
          status: ApplicationFeeStatus.VOIDED,
          voidedById,
          voidReason,
          voidedAt,
        },
      })
      .then((result) =>
        result.count === 0
          ? null
          : transaction.applicationFeeRecord.findUnique({
              where: { id: feeRecordId },
            }),
      );
  }

  /** Lists remaining active deposits for an application. */
  listActiveApplicationFees(
    applicationId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<ApplicationFeeRecord[]> {
    return transaction.applicationFeeRecord.findMany({
      where: { applicationId, status: ApplicationFeeStatus.RECORDED },
    });
  }

  /** Returns a caller's lifecycle status for service-level authorization checks. */
  async findUserStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status ?? null;
  }

  /** Finds an active application and active academic parents for admission. */
  findApplicationForAdmission(
    id: string,
    transaction: Prisma.TransactionClient,
  ): Promise<AdmissionsApplication | null> {
    return transaction.application.findFirst({
      where: {
        id,
        desiredProgramme: {
          is: {
            deletedAt: null,
            department: {
              is: { deletedAt: null, faculty: { is: { deletedAt: null } } },
            },
          },
        },
        desiredIntake: {
          is: { deletedAt: null, academicYear: { is: { deletedAt: null } } },
        },
      },
      include: admissionsApplicationInclude,
    });
  }

  /** Creates admission, enrollment, and intake-registration records for a student profile. */
  async createAdmissionRecords(
    transaction: Prisma.TransactionClient,
    input: {
      application: AdmissionsApplication;
      studentId: string;
      admittedById: string;
      studyMode: "ONLINE" | "PHYSICAL";
      admittedAt: Date;
    },
  ): Promise<{
    admission: AdmissionRecord;
    studentId: string;
    promptedCourseUnits: PromptedCourseUnit[];
  }> {
    const application = input.application;
    await transaction.programmeEnrollment.create({
      data: {
        studentId: input.studentId,
        programmeId: application.desiredProgrammeId,
        admissionIntakeId: application.desiredIntakeId,
        currentStudyYear: 1,
        currentIntakeSlot: application.desiredIntake.sequence,
        status: ProgrammeEnrollmentStatus.ACTIVE,
      },
    });
    await transaction.intakeRegistration.create({
      data: {
        studentId: input.studentId,
        intakeId: application.desiredIntakeId,
        status: IntakeRegistrationStatus.PENDING,
      },
    });
    const admission = await transaction.admissionRecord.create({
      data: {
        applicationId: application.id,
        studentId: input.studentId,
        programmeId: application.desiredProgrammeId,
        admissionIntakeId: application.desiredIntakeId,
        studyMode: input.studyMode,
        schedule: application.schedule,
        admittedById: input.admittedById,
        admittedAt: input.admittedAt,
      },
    });
    await transaction.application.update({
      where: { id: application.id },
      data: {
        status: ApplicationStatus.ADMITTED,
        studyMode: input.studyMode,
        admittedById: input.admittedById,
        admittedAt: input.admittedAt,
        studentId: input.studentId,
      },
    });
    const promptedCourseUnits = await transaction.programmeCourseUnit.findMany({
      where: {
        programmeId: application.desiredProgrammeId,
        studyYear: 1,
        intakeSlot: application.desiredIntake.sequence,
        courseUnit: {
          is: {
            status: "ACTIVE",
            ownerDepartment: { is: { deletedAt: null, faculty: { is: { deletedAt: null } } } },
          },
        },
      },
      select: {
        type: true,
        courseUnit: {
          select: { id: true, code: true, name: true, credits: true },
        },
      },
      orderBy: [{ type: "asc" }, { courseUnit: { code: "asc" } }],
    });
    await this.writeAudit(transaction, {
      actorId: input.admittedById,
      action: "admissions.application.admitted",
      resourceType: "application",
      resourceId: application.id,
      metadata: {
        studentId: input.studentId,
        studyMode: input.studyMode,
        studyYear: 1,
        intakeSlot: application.desiredIntake.sequence,
      },
    });

    return {
      admission,
      studentId: input.studentId,
      promptedCourseUnits: promptedCourseUnits.map(({ type, courseUnit }) => ({
        ...courseUnit,
        type,
      })),
    };
  }

  /** Finds the student account linked to an admitted application for credential resend. */
  findAdmittedStudentUser(applicationId: string): Promise<Pick<User, "id"> | null> {
    return this.prisma.application
      .findUnique({
        where: { id: applicationId },
        select: { student: { select: { userId: true } }, status: true },
      })
      .then((application) =>
        application?.status === ApplicationStatus.ADMITTED && application.student !== null
          ? { id: application.student.userId }
          : null,
      );
  }

  /** Finds required document states for an application's current status. */
  listApplicationDocumentsForStatus(
    applicationId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<Pick<ApplicationDocument, "type" | "status">[]> {
    return transaction.applicationDocument.findMany({
      where: { applicationId },
      select: { type: true, status: true },
    });
  }
}
