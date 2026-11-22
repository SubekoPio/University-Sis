// Purpose: Test admissions workflow eligibility, idempotency, fee handling, and email ordering.
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import {
  ApplicationDocumentStatus,
  ApplicationDocumentType,
  ApplicationFeeStatus,
  ApplicationSource,
  ApplicationStatus,
  StudentSchedule,
  StudyMode,
} from "@prisma/client";
import type {
  Application,
  ApplicationDocument,
  ApplicationFeeRecord,
  AdmissionRecord,
  Prisma,
  Student,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { StudentsService } from "../academic/students.service.js";
import { AdminUsersService } from "../users/admin-users.service.js";
import { AdmissionEligibilityError } from "./admission.errors.js";
import { AdmissionService } from "./admission.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import { ApplicationFeeService } from "./application-fee.service.js";
import { ApplicationsService } from "./applications.service.js";
import { DocumentReviewService } from "./document-review.service.js";
import type { AdmissionsApplication } from "./admissions.types.js";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const APPLICATION_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const ADMITTER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const REVIEWER_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const STUDENT_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const USER_ID = "a22d7a09-058a-4cc7-844e-345963631882";
const PROGRAMME_ID = "e8f80e2c-f7a1-4aae-aee9-975505d38742";
const INTAKE_ID = "2215dfac-6bcf-4dcf-90b0-2734295ee52a";
const FEE_ID = "9214dfac-6bcf-4dcf-90b0-2734295ee52a";
const TRANSACTION = null as unknown as Prisma.TransactionClient;

const requiredDocuments: ApplicationDocument[] = [
  ApplicationDocumentType.ID,
  ApplicationDocumentType.TRANSCRIPT,
  ApplicationDocumentType.CERTIFICATE,
  ApplicationDocumentType.PHOTO,
].map((type, index) => ({
  id: `c2d0b38c-26f3-466c-9a9e-6cc36122362${index}`,
  applicationId: APPLICATION_ID,
  type,
  storageKey: `applicants/${APPLICATION_ID}/${type.toLowerCase()}`,
  status: ApplicationDocumentStatus.APPROVED,
  reviewerNote: "Verified",
  reviewedById: REVIEWER_ID,
  reviewedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
}));

const firstRequiredDocument = requiredDocuments[0];
const finalRequiredDocument = requiredDocuments[3];
if (firstRequiredDocument === undefined || finalRequiredDocument === undefined) {
  throw new Error("The admissions fixture must include all four required documents.");
}

const application: AdmissionsApplication = {
  id: APPLICATION_ID,
  applicantName: "Avery Student",
  email: "avery@example.test",
  phone: "+256700000000",
  dateOfBirth: new Date("2005-04-15T00:00:00.000Z"),
  nationality: "Ugandan",
  studyMode: StudyMode.PHYSICAL,
  schedule: StudentSchedule.DAY,
  desiredProgrammeId: PROGRAMME_ID,
  desiredIntakeId: INTAKE_ID,
  source: ApplicationSource.ADMISSION_OFFICE,
  externalRef: null,
  status: ApplicationStatus.FEE_CONFIRMED,
  enteredById: REVIEWER_ID,
  admittedById: null,
  admittedAt: null,
  studentId: null,
  createdAt: NOW,
  updatedAt: NOW,
  documents: requiredDocuments,
  feeRecords: [
    {
      id: FEE_ID,
      applicationId: APPLICATION_ID,
      amountMinor: 5_000,
      currency: "UGX",
      bankName: "BANK",
      bankReference: "REF-1",
      depositDate: NOW,
      recordedById: REVIEWER_ID,
      status: ApplicationFeeStatus.RECORDED,
      voidedAt: null,
      voidedById: null,
      voidReason: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  desiredIntake: { id: INTAKE_ID, sequence: 2 },
};

const studentProfile: Student = {
  id: STUDENT_ID,
  userId: USER_ID,
  studentNumber: "SIS-test-number",
  phone: "+256700000000",
  dateOfBirth: new Date("2005-04-15T00:00:00.000Z"),
  gender: null,
  nationality: "Ugandan",
  nationalId: null,
  address: null,
  nextOfKinName: null,
  nextOfKinPhone: null,
  nextOfKinRelationship: null,
  schedule: StudentSchedule.DAY,
  createdAt: NOW,
  updatedAt: NOW,
};

const applicationRecord: Application = {
  id: application.id,
  applicantName: application.applicantName,
  email: application.email,
  phone: application.phone,
  dateOfBirth: application.dateOfBirth,
  nationality: application.nationality,
  studyMode: application.studyMode,
  schedule: application.schedule,
  desiredProgrammeId: application.desiredProgrammeId,
  desiredIntakeId: application.desiredIntakeId,
  source: application.source,
  externalRef: application.externalRef,
  status: application.status,
  enteredById: application.enteredById,
  admittedById: application.admittedById,
  admittedAt: application.admittedAt,
  studentId: application.studentId,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
};

const feeRecord: ApplicationFeeRecord = {
  id: FEE_ID,
  applicationId: APPLICATION_ID,
  amountMinor: 5_000,
  currency: "UGX",
  bankName: "BANK",
  bankReference: "REF-1",
  depositDate: NOW,
  recordedById: REVIEWER_ID,
  status: ApplicationFeeStatus.RECORDED,
  voidedAt: null,
  voidedById: null,
  voidReason: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const admissionRecord: AdmissionRecord = {
  id: FEE_ID,
  applicationId: APPLICATION_ID,
  studentId: STUDENT_ID,
  programmeId: PROGRAMME_ID,
  admissionIntakeId: INTAKE_ID,
  studyMode: StudyMode.PHYSICAL,
  schedule: StudentSchedule.DAY,
  admittedById: ADMITTER_ID,
  admittedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const repositoryMock = {
  createApplication: vi.fn<AdmissionsRepository["createApplication"]>(),
  createAdmissionRecords: vi.fn<AdmissionsRepository["createAdmissionRecords"]>(),
  createApplicationFee: vi.fn<AdmissionsRepository["createApplicationFee"]>(),
  findAdmittedStudentUser: vi.fn<AdmissionsRepository["findAdmittedStudentUser"]>(),
  findApplication: vi.fn<AdmissionsRepository["findApplication"]>(),
  findApplicationForAdmission: vi.fn<AdmissionsRepository["findApplicationForAdmission"]>(),
  findApplicationForFee: vi.fn<AdmissionsRepository["findApplicationForFee"]>(),
  findDocumentForReview: vi.fn<AdmissionsRepository["findDocumentForReview"]>(),
  findFeeRecord: vi.fn<AdmissionsRepository["findFeeRecord"]>(),
  findUserStatus: vi.fn<AdmissionsRepository["findUserStatus"]>(),
  findWebsiteApplication: vi.fn<AdmissionsRepository["findWebsiteApplication"]>(),
  hasActiveProgrammeAndIntake: vi.fn<AdmissionsRepository["hasActiveProgrammeAndIntake"]>(),
  listApplicationDocuments: vi.fn<AdmissionsRepository["listApplicationDocuments"]>(),
  listApplicationDocumentsForStatus:
    vi.fn<AdmissionsRepository["listApplicationDocumentsForStatus"]>(),
  listActiveApplicationFees: vi.fn<AdmissionsRepository["listActiveApplicationFees"]>(),
  updateApplicationStatus: vi.fn<AdmissionsRepository["updateApplicationStatus"]>(),
  updateDocumentReview: vi.fn<AdmissionsRepository["updateDocumentReview"]>(),
  voidApplicationFee: vi.fn<AdmissionsRepository["voidApplicationFee"]>(),
  withTransaction: vi.fn<AdmissionsRepository["withTransaction"]>(),
  writeAudit: vi.fn<AdmissionsRepository["writeAudit"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};

const adminUsersMock = {
  createStudentForAdmission: vi.fn<AdminUsersService["createStudentForAdmission"]>(),
  sendAdmissionStudentCredentials: vi.fn<AdminUsersService["sendAdmissionStudentCredentials"]>(),
  resendAdmissionStudentCredentials:
    vi.fn<AdminUsersService["resendAdmissionStudentCredentials"]>(),
};

const studentsMock = {
  createProfileForAdmission: vi.fn<StudentsService["createProfileForAdmission"]>(),
};

describe("Admissions services", () => {
  let moduleRef: TestingModule;
  let admissionService: AdmissionService;
  let applicationFeeService: ApplicationFeeService;
  let applicationsService: ApplicationsService;
  let documentReviewService: DocumentReviewService;
  const events: string[] = [];

  beforeEach(async () => {
    vi.resetAllMocks();
    events.length = 0;
    repositoryMock.withTransaction.mockImplementation(async (work) => {
      const result = await work(TRANSACTION);
      events.push("transaction-committed");
      return result;
    });
    repositoryMock.findUserStatus.mockResolvedValue("ACTIVE");
    repositoryMock.findApplicationForAdmission.mockResolvedValue(application);
    repositoryMock.findApplicationForFee.mockResolvedValue(applicationRecord);
    repositoryMock.findApplication.mockResolvedValue(application);
    repositoryMock.findWebsiteApplication.mockResolvedValue(null);
    repositoryMock.hasActiveProgrammeAndIntake.mockResolvedValue(true);
    repositoryMock.findDocumentForReview.mockResolvedValue({
      ...finalRequiredDocument,
      status: ApplicationDocumentStatus.PENDING,
      application: applicationRecord,
    });
    repositoryMock.updateDocumentReview.mockImplementation(
      async (documentId, reviewerId, status, note, reviewedAt) => ({
        ...finalRequiredDocument,
        id: documentId,
        reviewedById: reviewerId,
        status,
        reviewerNote: note,
        reviewedAt,
      }),
    );
    repositoryMock.listApplicationDocuments.mockResolvedValue([
      ...requiredDocuments,
      {
        ...firstRequiredDocument,
        id: FEE_ID,
        type: ApplicationDocumentType.OTHER,
        status: ApplicationDocumentStatus.REJECTED,
      },
    ]);
    repositoryMock.updateApplicationStatus.mockResolvedValue(applicationRecord);
    repositoryMock.writeAudit.mockResolvedValue();
    repositoryMock.createApplicationFee.mockResolvedValue(feeRecord);
    repositoryMock.findFeeRecord.mockResolvedValue({
      ...feeRecord,
      application: applicationRecord,
    });
    repositoryMock.voidApplicationFee.mockResolvedValue({
      ...feeRecord,
      status: ApplicationFeeStatus.VOIDED,
    });
    repositoryMock.listActiveApplicationFees.mockResolvedValue([]);
    repositoryMock.listApplicationDocumentsForStatus.mockResolvedValue(requiredDocuments);
    repositoryMock.createAdmissionRecords.mockImplementation(async () => {
      events.push("admission-records-created");
      return {
        admission: admissionRecord,
        studentId: STUDENT_ID,
        promptedCourseUnits: [],
      };
    });
    adminUsersMock.createStudentForAdmission.mockImplementation(async () => {
      events.push("student-account-created");
      return {
        user: {
          id: USER_ID,
          email: application.email,
          name: application.applicantName,
          temporaryPasswordExpiresAt: NOW,
        },
        temporaryPassword: "one-time-password",
      };
    });
    studentsMock.createProfileForAdmission.mockImplementation(async () => {
      events.push("student-profile-created");
      return studentProfile;
    });
    adminUsersMock.sendAdmissionStudentCredentials.mockImplementation(async () => {
      events.push("credentials-email-attempted");
      return false;
    });
    adminUsersMock.resendAdmissionStudentCredentials.mockResolvedValue(true);
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: [
        "admissions:application:manage",
        "admissions:document:review",
        "admissions:fee:confirm",
        "admissions:admit",
        "sis:student:create_after_admission",
      ],
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        AdmissionService,
        ApplicationFeeService,
        ApplicationsService,
        DocumentReviewService,
        { provide: AdmissionsRepository, useValue: repositoryMock },
        { provide: StudentsService, useValue: studentsMock },
        { provide: RbacService, useValue: rbacMock },
        { provide: AdminUsersService, useValue: adminUsersMock },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            APPLICATION_FEE_AMOUNT_MINOR: 5_000,
            CURRENCY: "UGX",
            APP_URL: "https://sis.example.test",
          }),
        },
      ],
    }).compile();
    admissionService = moduleRef.get(AdmissionService);
    applicationFeeService = moduleRef.get(ApplicationFeeService);
    applicationsService = moduleRef.get(ApplicationsService);
    documentReviewService = moduleRef.get(DocumentReviewService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("keeps admissions idempotent by website external reference", async () => {
    // Arrange: an earlier website delivery already owns this external reference.
    repositoryMock.findWebsiteApplication.mockResolvedValue(applicationRecord);

    // Act: replay the same external reference with valid applicant data.
    const result = await applicationsService.createWebsiteApplication({
      applicantName: "Avery Student",
      email: "avery@example.test",
      phone: "+256700000000",
      dateOfBirth: new Date("2005-04-15T00:00:00.000Z"),
      nationality: "Ugandan",
      studyMode: StudyMode.PHYSICAL,
      schedule: StudentSchedule.DAY,
      desiredProgrammeId: PROGRAMME_ID,
      desiredIntakeId: INTAKE_ID,
      externalRef: "website-application-123",
    });

    // Assert: the existing application is returned without creating another record.
    expect(result.id).toBe(APPLICATION_ID);
    expect(repositoryMock.createApplication).not.toHaveBeenCalled();
    expect(repositoryMock.hasActiveProgrammeAndIntake).not.toHaveBeenCalled();
  });

  it("promotes required approved documents while ignoring rejected optional documents", async () => {
    // Arrange: the final required document is reviewed while all four required types are approved.
    repositoryMock.findDocumentForReview.mockResolvedValue({
      ...finalRequiredDocument,
      status: ApplicationDocumentStatus.PENDING,
      application: { ...applicationRecord, status: ApplicationStatus.SUBMITTED },
    });

    // Act: approve the selected document with a required note.
    const result = await documentReviewService.approveDocument(
      finalRequiredDocument.id,
      REVIEWER_ID,
      "Identity and photo verified.",
    );

    // Assert: optional OTHER rejection does not prevent document approval.
    expect(result.applicationStatus).toBe(ApplicationStatus.DOCS_APPROVED);
    expect(repositoryMock.updateDocumentReview).toHaveBeenCalledWith(
      finalRequiredDocument.id,
      REVIEWER_ID,
      ApplicationDocumentStatus.APPROVED,
      "Identity and photo verified.",
      expect.any(Date),
      TRANSACTION,
    );
    expect(repositoryMock.updateApplicationStatus).toHaveBeenCalledWith(
      APPLICATION_ID,
      ApplicationStatus.DOCS_APPROVED,
      TRANSACTION,
    );
  });

  it("rejects a document review without a note", async () => {
    // Arrange: the reviewer has permission and the document exists.

    // Act / Assert: no transaction starts when the required note is missing.
    await expect(
      documentReviewService.rejectDocument(firstRequiredDocument.id, REVIEWER_ID, "  "),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repositoryMock.withTransaction).not.toHaveBeenCalled();
  });

  it("confirms a fee only when a whole-minor-unit deposit meets the configured amount", async () => {
    // Arrange: the bank deposit is valid but one minor unit below the configured fee.

    // Act: record the underpayment.
    await applicationFeeService.record(
      {
        applicationId: APPLICATION_ID,
        bankName: "  example bank ",
        bankReference: " REF-LOW ",
        amountMinor: 4_999,
        depositDate: NOW,
      },
      REVIEWER_ID,
    );

    // Assert: the amount remains an integer, normalized bank name is stored, and status is unchanged.
    expect(repositoryMock.createApplicationFee).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 4_999,
        currency: "UGX",
        bankName: "EXAMPLE BANK",
        bankReference: "REF-LOW",
      }),
      TRANSACTION,
    );
    expect(repositoryMock.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it("confirms the application fee at the exact configured minor-unit amount", async () => {
    // Arrange: record an integer deposit exactly equal to the configured amount.

    // Act: record the deposit.
    await applicationFeeService.record(
      {
        applicationId: APPLICATION_ID,
        bankName: "Example Bank",
        bankReference: "REF-EXACT",
        amountMinor: 5_000,
        depositDate: NOW,
      },
      REVIEWER_ID,
    );

    // Assert: the application reaches FEE_CONFIRMED at the exact threshold.
    expect(repositoryMock.updateApplicationStatus).toHaveBeenCalledWith(
      APPLICATION_ID,
      ApplicationStatus.FEE_CONFIRMED,
      TRANSACTION,
    );
  });

  it("rejects fractional minor-unit fee amounts", async () => {
    // Arrange: provide a bank reference with a non-integer monetary amount.

    // Act / Assert: money validation fails before starting persistence.
    await expect(
      applicationFeeService.record(
        {
          applicationId: APPLICATION_ID,
          bankName: "Example Bank",
          bankReference: "REF-FRACTION",
          amountMinor: 5_000.5,
          depositDate: NOW,
        },
        REVIEWER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repositoryMock.withTransaction).not.toHaveBeenCalled();
  });

  it("rejects a duplicate bank and reference pair", async () => {
    // Arrange: Prisma reports a uniqueness violation for an already-used deposit reference.
    repositoryMock.createApplicationFee.mockRejectedValue(
      new PrismaNamespace.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    // Act / Assert: duplicate deposits receive a clear conflict response.
    await expect(
      applicationFeeService.record(
        {
          applicationId: APPLICATION_ID,
          bankName: "Example Bank",
          bankReference: "REF-1",
          amountMinor: 5_000,
          depositDate: NOW,
        },
        REVIEWER_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("prohibits the fee recorder from voiding their own deposit", async () => {
    // Arrange: the active fee belongs to the same user attempting the void.
    repositoryMock.findFeeRecord.mockResolvedValue({
      ...feeRecord,
      recordedById: REVIEWER_ID,
      application: applicationRecord,
    });

    // Act / Assert: enforce maker-checker before changing the immutable fee record.
    await expect(
      applicationFeeService.void(FEE_ID, REVIEWER_ID, "Duplicate entry."),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositoryMock.voidApplicationFee).not.toHaveBeenCalled();
  });

  it("does not admit an application missing a required document", async () => {
    // Arrange: all other requirements pass, but the photo document is absent.
    repositoryMock.findApplicationForAdmission.mockResolvedValue({
      ...application,
      documents: requiredDocuments.filter(
        (document) => document.type !== ApplicationDocumentType.PHOTO,
      ),
    });

    // Act / Assert: typed prerequisite failures stop account creation and email.
    await expect(
      admissionService.admit(APPLICATION_ID, ADMITTER_ID, StudyMode.PHYSICAL),
    ).rejects.toBeInstanceOf(AdmissionEligibilityError);
    expect(adminUsersMock.createStudentForAdmission).not.toHaveBeenCalled();
    expect(adminUsersMock.sendAdmissionStudentCredentials).not.toHaveBeenCalled();
  });

  it("does not admit an application without a qualifying active fee", async () => {
    // Arrange: all required documents are approved but no recorded fee meets the configured amount.
    repositoryMock.findApplicationForAdmission.mockResolvedValue({
      ...application,
      feeRecords: [],
    });

    // Act / Assert: the typed failure identifies the missing fee confirmation.
    await expect(
      admissionService.admit(APPLICATION_ID, ADMITTER_ID, StudyMode.PHYSICAL),
    ).rejects.toMatchObject({
      failures: ["APPLICATION_FEE_NOT_CONFIRMED"],
    });
    expect(adminUsersMock.createStudentForAdmission).not.toHaveBeenCalled();
  });

  it("denies admission when the actor lacks admissions:admit", async () => {
    // Arrange: remove the admission capability from the actor's current permission snapshot.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["admissions:document:review"],
    });

    // Act / Assert: permission checks happen before the admission transaction.
    await expect(
      admissionService.admit(APPLICATION_ID, ADMITTER_ID, StudyMode.PHYSICAL),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositoryMock.withTransaction).not.toHaveBeenCalled();
  });

  it("commits admission records before sending credentials and preserves admission on email failure", async () => {
    // Arrange: eligibility and separation-of-duties checks pass; email delivery is unavailable.
    // Act: admit the applicant and let the post-commit email attempt fail.
    const result = await admissionService.admit(APPLICATION_ID, ADMITTER_ID, StudyMode.PHYSICAL);

    // Assert: all records commit before email; failed delivery is reported without undoing admission.
    expect(events).toEqual([
      "student-account-created",
      "student-profile-created",
      "admission-records-created",
      "transaction-committed",
      "credentials-email-attempted",
    ]);
    expect(result.admission).toBe(admissionRecord);
    expect(result.credentialsEmailSent).toBe(false);
    expect(result.studentId).toBe(STUDENT_ID);
    expect(repositoryMock.createAdmissionRecords).toHaveBeenCalledWith(
      TRANSACTION,
      expect.objectContaining({
        application,
        studentId: STUDENT_ID,
        studyMode: StudyMode.PHYSICAL,
        admittedById: ADMITTER_ID,
      }),
    );
    expect(studentsMock.createProfileForAdmission).toHaveBeenCalledWith(
      TRANSACTION,
      expect.objectContaining({
        userId: USER_ID,
        phone: application.phone,
        schedule: application.schedule,
      }),
      ADMITTER_ID,
    );
  });

  it("prevents a document approver from admitting the same application", async () => {
    // Arrange: required documents are approved by another user, but the actor approved an optional document.
    repositoryMock.findApplicationForAdmission.mockResolvedValue({
      ...application,
      documents: [
        ...requiredDocuments,
        {
          ...firstRequiredDocument,
          id: FEE_ID,
          type: ApplicationDocumentType.OTHER,
          status: ApplicationDocumentStatus.APPROVED,
          reviewedById: ADMITTER_ID,
        },
      ],
    });

    // Act / Assert: the separate admissions permission does not override separation of duties.
    await expect(
      admissionService.admit(APPLICATION_ID, ADMITTER_ID, StudyMode.PHYSICAL),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsersMock.createStudentForAdmission).not.toHaveBeenCalled();
  });
});
