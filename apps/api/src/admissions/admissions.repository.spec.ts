// Purpose: Verify atomic creation of admission and enrollment records in the supplied transaction.
import { Test, TestingModule } from "@nestjs/testing";
import {
  ApplicationSource,
  ApplicationStatus,
  IntakeRegistrationStatus,
  ProgrammeEnrollmentStatus,
  StudentSchedule,
  StudyMode,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import type { AdmissionsApplication } from "./admissions.types.js";

const APPLICATION_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const ADMITTER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const STUDENT_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const PROGRAMME_ID = "a22d7a09-058a-4cc7-844e-345963631882";
const INTAKE_ID = "e8f80e2c-f7a1-4aae-aee9-975505d38742";
const NOW = new Date("2026-11-22T12:00:00.000Z");
const transactionMock = {
  admissionRecord: { create: vi.fn() },
  application: { update: vi.fn() },
  auditLog: { create: vi.fn() },
  intakeRegistration: { create: vi.fn() },
  programmeCourseUnit: { findMany: vi.fn() },
  programmeEnrollment: { create: vi.fn() },
};

const application: AdmissionsApplication = {
  id: APPLICATION_ID,
  applicantName: "Avery Student",
  email: "avery@example.test",
  phone: "+256700000000",
  dateOfBirth: new Date("2005-04-15T00:00:00.000Z"),
  nationality: "Ugandan",
  studyMode: StudyMode.PHYSICAL,
  schedule: StudentSchedule.EVENING,
  desiredProgrammeId: PROGRAMME_ID,
  desiredIntakeId: INTAKE_ID,
  source: ApplicationSource.ADMISSION_OFFICE,
  externalRef: null,
  status: ApplicationStatus.FEE_CONFIRMED,
  enteredById: ADMITTER_ID,
  admittedById: null,
  admittedAt: null,
  studentId: null,
  createdAt: NOW,
  updatedAt: NOW,
  documents: [],
  feeRecords: [],
  desiredIntake: { id: INTAKE_ID, sequence: 3 },
};

const admission = {
  id: "9214dfac-6bcf-4dcf-90b0-2734295ee52a",
  applicationId: APPLICATION_ID,
  studentId: STUDENT_ID,
  programmeId: PROGRAMME_ID,
  admissionIntakeId: INTAKE_ID,
  studyMode: StudyMode.ONLINE,
  schedule: StudentSchedule.EVENING,
  admittedById: ADMITTER_ID,
  admittedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("AdmissionsRepository", () => {
  let moduleRef: TestingModule;
  let repository: AdmissionsRepository;
  const prismaMock = { $transaction: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    transactionMock.admissionRecord.create.mockResolvedValue(admission);
    transactionMock.application.update.mockResolvedValue({});
    transactionMock.auditLog.create.mockResolvedValue({});
    transactionMock.intakeRegistration.create.mockResolvedValue({});
    transactionMock.programmeCourseUnit.findMany.mockResolvedValue([
      {
        type: "CORE",
        courseUnit: {
          id: STUDENT_ID,
          code: "CS101",
          name: "Foundations",
          credits: 3,
        },
      },
    ]);
    transactionMock.programmeEnrollment.create.mockResolvedValue({});

    moduleRef = await Test.createTestingModule({
      providers: [AdmissionsRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    repository = moduleRef.get(AdmissionsRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("writes admission, enrollment, intake, and prompted curriculum through one transaction", async () => {
    // Arrange: use a caller-owned Prisma transaction for every new admission record.
    const transaction = transactionMock as unknown as Prisma.TransactionClient;

    // Act: persist the admission and read its first-year intake-slot curriculum.
    const result = await repository.createAdmissionRecords(transaction, {
      application,
      studentId: STUDENT_ID,
      admittedById: ADMITTER_ID,
      studyMode: StudyMode.ONLINE,
      admittedAt: NOW,
    });

    // Assert: the admission preserves the applicant schedule and enrollment starts at year one, slot three.
    expect(transactionMock.programmeEnrollment.create).toHaveBeenCalledWith({
      data: {
        studentId: STUDENT_ID,
        programmeId: PROGRAMME_ID,
        admissionIntakeId: INTAKE_ID,
        currentStudyYear: 1,
        currentIntakeSlot: 3,
        status: ProgrammeEnrollmentStatus.ACTIVE,
      },
    });
    expect(transactionMock.intakeRegistration.create).toHaveBeenCalledWith({
      data: {
        studentId: STUDENT_ID,
        intakeId: INTAKE_ID,
        status: IntakeRegistrationStatus.PENDING,
      },
    });
    expect(transactionMock.admissionRecord.create).toHaveBeenCalledWith({
      data: {
        applicationId: APPLICATION_ID,
        studentId: STUDENT_ID,
        programmeId: PROGRAMME_ID,
        admissionIntakeId: INTAKE_ID,
        studyMode: StudyMode.ONLINE,
        schedule: StudentSchedule.EVENING,
        admittedById: ADMITTER_ID,
        admittedAt: NOW,
      },
    });
    expect(transactionMock.application.update).toHaveBeenCalledWith({
      where: { id: APPLICATION_ID },
      data: {
        status: ApplicationStatus.ADMITTED,
        studyMode: StudyMode.ONLINE,
        admittedById: ADMITTER_ID,
        admittedAt: NOW,
        studentId: STUDENT_ID,
      },
    });
    expect(transactionMock.programmeCourseUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          programmeId: PROGRAMME_ID,
          studyYear: 1,
          intakeSlot: 3,
          courseUnit: expect.any(Object),
        },
      }),
    );
    expect(result.promptedCourseUnits).toEqual([
      {
        id: STUDENT_ID,
        code: "CS101",
        name: "Foundations",
        credits: 3,
        type: "CORE",
      },
    ]);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
