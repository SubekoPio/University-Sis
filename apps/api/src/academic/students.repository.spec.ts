// Purpose: Verify transactional student archival and audited study-mode persistence.
import { ApplicationStatus, Prisma, StudentSchedule, StudyMode, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { StudentsRepository } from "./students.repository.js";
import type { StudyModeAdmission } from "./students.repository.js";

const STUDENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ACTOR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const APPLICATION_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const NOW = new Date("2026-11-22T12:00:00.000Z");

const currentAdmission: StudyModeAdmission = {
  id: "9214dfac-6bcf-4dcf-90b0-2734295ee52a",
  applicationId: APPLICATION_ID,
  studentId: STUDENT_ID,
  programmeId: "a22d7a09-058a-4cc7-844e-345963631882",
  admissionIntakeId: "e8f80e2c-f7a1-4aae-aee9-975505d38742",
  studyMode: StudyMode.PHYSICAL,
  schedule: StudentSchedule.DAY,
  admittedById: ACTOR_ID,
  admittedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  application: {
    id: APPLICATION_ID,
    status: ApplicationStatus.ADMITTED,
    studentId: STUDENT_ID,
    studyMode: StudyMode.PHYSICAL,
  },
  student: { user: { status: UserStatus.ACTIVE } },
};

const transactionMock = {
  admissionRecord: { findUnique: vi.fn(), update: vi.fn() },
  application: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  session: { updateMany: vi.fn() },
  student: { create: vi.fn(), findUnique: vi.fn() },
  user: { findFirst: vi.fn(), updateMany: vi.fn() },
};

const transactionOptions: Array<{ isolationLevel?: string } | undefined> = [];
const prismaMock = {
  $transaction: vi.fn(
    async (
      work: (transaction: Prisma.TransactionClient) => Promise<unknown>,
      options?: { isolationLevel?: string },
    ) => {
      transactionOptions.push(options);
      return work(transactionMock as unknown as Prisma.TransactionClient);
    },
  ),
};

describe("StudentsRepository", () => {
  let repository: StudentsRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    transactionOptions.length = 0;
    transactionMock.auditLog.create.mockResolvedValue({});
    transactionMock.user.findFirst.mockResolvedValue({ id: STUDENT_USER_ID });
    transactionMock.student.create.mockResolvedValue({
      id: STUDENT_ID,
      studentNumber: "SIS-123",
    });
    transactionMock.student.findUnique.mockResolvedValue({ userId: STUDENT_USER_ID });
    transactionMock.user.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.session.updateMany.mockResolvedValue({ count: 2 });
    transactionMock.admissionRecord.findUnique.mockResolvedValue(currentAdmission);
    transactionMock.application.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.admissionRecord.update.mockResolvedValue({
      ...currentAdmission,
      studyMode: StudyMode.ONLINE,
      application: { ...currentAdmission.application, studyMode: StudyMode.ONLINE },
    });
    repository = new StudentsRepository(prismaMock as unknown as PrismaService);
  });

  it("creates the student profile and audit entry through the admission transaction", async () => {
    // Arrange: the admission transaction contains an active student account without a profile.
    const transaction = transactionMock as unknown as Prisma.TransactionClient;

    // Act: create the profile for the newly admitted account.
    await repository.createProfileForAdmission(
      transaction,
      {
        userId: STUDENT_USER_ID,
        studentNumber: "SIS-123",
        phone: "+256700000000",
        dateOfBirth: NOW,
        nationality: "Ugandan",
        schedule: StudentSchedule.DAY,
      },
      ACTOR_ID,
    );

    // Assert: both profile creation and its audit use the caller's transaction.
    expect(transactionMock.student.create).toHaveBeenCalledWith({
      data: {
        userId: STUDENT_USER_ID,
        studentNumber: "SIS-123",
        phone: "+256700000000",
        dateOfBirth: NOW,
        nationality: "Ugandan",
        schedule: StudentSchedule.DAY,
      },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ACTOR_ID,
        action: "sis.student.created_after_admission",
        resourceType: "student",
        resourceId: STUDENT_ID,
        metadata: { studentNumber: "SIS-123" },
      },
    });
  });

  it("archives by deactivating the user and revoking sessions without deleting history", async () => {
    // Arrange: the student profile remains linked to its existing account.

    // Act: archive the profile.
    const userId = await repository.archive(STUDENT_ID, ACTOR_ID, NOW);

    // Assert: account status, session revocation, and audit are in the same transaction.
    expect(userId).toBe(STUDENT_USER_ID);
    expect(transactionMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: STUDENT_USER_ID, status: { not: UserStatus.DEACTIVATED } },
      data: {
        status: UserStatus.DEACTIVATED,
        deactivatedAt: NOW,
        deactivatedById: ACTOR_ID,
      },
    });
    expect(transactionMock.session.updateMany).toHaveBeenCalledWith({
      where: { userId: STUDENT_USER_ID, revokedAt: null },
      data: { revokedAt: NOW },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ACTOR_ID,
        action: "sis.student.archived",
        resourceType: "student",
        resourceId: STUDENT_ID,
      },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("updates both study-mode records and stores reason and prior mode in the audit log", async () => {
    // Arrange: the application and its admission record currently agree on physical study mode.

    // Act: apply an approved transition to online study mode.
    const result = await repository.changeStudyMode(
      APPLICATION_ID,
      StudyMode.ONLINE,
      ACTOR_ID,
      "Approved accommodation.",
    );

    // Assert: both records and the immutable audit are written in one serializable transaction.
    expect(result.kind).toBe("changed");
    expect(transactionMock.application.updateMany).toHaveBeenCalledWith({
      where: {
        id: APPLICATION_ID,
        status: ApplicationStatus.ADMITTED,
        studentId: STUDENT_ID,
        studyMode: StudyMode.PHYSICAL,
      },
      data: { studyMode: StudyMode.ONLINE },
    });
    expect(transactionMock.admissionRecord.update).toHaveBeenCalledWith({
      where: { applicationId: APPLICATION_ID },
      data: { studyMode: StudyMode.ONLINE },
      include: expect.any(Object),
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ACTOR_ID,
        action: "sis.student.study_mode_changed",
        resourceType: "admission_record",
        resourceId: currentAdmission.id,
        reason: "Approved accommodation.",
        metadata: {
          applicationId: APPLICATION_ID,
          from: StudyMode.PHYSICAL,
          to: StudyMode.ONLINE,
        },
      },
    });
    expect(transactionOptions[0]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});
