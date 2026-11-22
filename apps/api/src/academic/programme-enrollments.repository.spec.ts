// Purpose: Verify transactional enrollment status and intake-progression writes.
import {
  IntakeRegistrationStatus,
  IntakeStatus,
  Prisma,
  ProgrammeEnrollmentStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { ProgrammeEnrollmentsRepository } from "./programme-enrollments.repository.js";

const ENROLLMENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ACTOR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const INTAKE_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";

const transactionMock = {
  auditLog: { create: vi.fn() },
  intake: { findFirst: vi.fn() },
  intakeRegistration: { updateMany: vi.fn() },
  programmeEnrollment: { findUnique: vi.fn(), updateMany: vi.fn() },
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

describe("ProgrammeEnrollmentsRepository", () => {
  let repository: ProgrammeEnrollmentsRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    transactionOptions.length = 0;
    transactionMock.auditLog.create.mockResolvedValue({});
    transactionMock.intake.findFirst.mockResolvedValue({
      id: INTAKE_ID,
      status: IntakeStatus.CLOSED,
    });
    transactionMock.intakeRegistration.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.programmeEnrollment.findUnique
      .mockResolvedValueOnce({
        id: ENROLLMENT_ID,
        studentId: STUDENT_ID,
        currentStudyYear: 1,
        currentIntakeSlot: 3,
      })
      .mockResolvedValueOnce({ id: ENROLLMENT_ID, status: ProgrammeEnrollmentStatus.ACTIVE });
    transactionMock.programmeEnrollment.updateMany.mockResolvedValue({ count: 1 });
    repository = new ProgrammeEnrollmentsRepository(prismaMock as unknown as PrismaService);
  });

  it("completes the intake, advances the enrollment, and audits in one transaction", async () => {
    // Arrange: the student is registered for the closed intake and the enrollment is still at slot three.

    // Act: advance to the next study year.
    const result = await repository.advanceAfterIntake({
      enrollmentId: ENROLLMENT_ID,
      intakeId: INTAKE_ID,
      currentStudyYear: 1,
      currentIntakeSlot: 3,
      nextStudyYear: 2,
      nextIntakeSlot: 1,
      nextStatus: ProgrammeEnrollmentStatus.ACTIVE,
      actorId: ACTOR_ID,
    });

    // Assert: both lifecycle writes and their audit share a serializable transaction.
    expect(result).not.toBeNull();
    expect(transactionMock.intakeRegistration.updateMany).toHaveBeenCalledWith({
      where: {
        studentId: STUDENT_ID,
        intakeId: INTAKE_ID,
        status: IntakeRegistrationStatus.REGISTERED,
      },
      data: { status: IntakeRegistrationStatus.COMPLETED },
    });
    expect(transactionMock.programmeEnrollment.updateMany).toHaveBeenCalledWith({
      where: {
        id: ENROLLMENT_ID,
        status: ProgrammeEnrollmentStatus.ACTIVE,
        currentStudyYear: 1,
        currentIntakeSlot: 3,
      },
      data: {
        currentStudyYear: 2,
        currentIntakeSlot: 1,
        status: ProgrammeEnrollmentStatus.ACTIVE,
      },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "academic.enrollment.progressed",
          resourceId: ENROLLMENT_ID,
        }),
      }),
    );
    expect(transactionOptions[0]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("does not report success or write an audit when a concurrent update wins", async () => {
    // Arrange: another transaction changes the enrollment before the conditional update.
    transactionMock.programmeEnrollment.updateMany.mockResolvedValue({ count: 0 });

    // Act: attempt progression after the registration update was prepared.
    const result = await repository.advanceAfterIntake({
      enrollmentId: ENROLLMENT_ID,
      intakeId: INTAKE_ID,
      currentStudyYear: 1,
      currentIntakeSlot: 3,
      nextStudyYear: 2,
      nextIntakeSlot: 1,
      nextStatus: ProgrammeEnrollmentStatus.ACTIVE,
      actorId: ACTOR_ID,
    });

    // Assert: the repository reports a conflict and never writes an audit success.
    expect(result).toBeNull();
    expect(transactionMock.auditLog.create).not.toHaveBeenCalled();
  });
});
