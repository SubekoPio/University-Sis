// Purpose: Test enrollment history scope, lifecycle transitions, and intake progression.
import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  IntakeRegistrationStatus,
  IntakeStatus,
  ProgrammeEnrollmentStatus,
  UserStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { ProgrammeEnrollmentsRepository } from "./programme-enrollments.repository.js";
import type {
  EnrollmentProgressionContext,
  ProgrammeEnrollmentRecord,
} from "./programme-enrollments.repository.js";
import { ProgrammeEnrollmentService } from "./programme-enrollment.service.js";

const ENROLLMENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const STUDENT_USER_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const ACTOR_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const INTAKE_ID = "9214dfac-6bcf-4dcf-90b0-2734295ee52a";
const YEAR_ONE_ID = "e8f80e2c-f7a1-4aae-aee9-975505d38742";
const YEAR_TWO_ID = "2215dfac-6bcf-4dcf-90b0-2734295ee52a";

const enrollment: ProgrammeEnrollmentRecord = {
  id: ENROLLMENT_ID,
  studentId: STUDENT_ID,
  programmeId: "a22d7a09-058a-4cc7-844e-345963631882",
  admissionIntakeId: INTAKE_ID,
  currentStudyYear: 1,
  currentIntakeSlot: 3,
  status: ProgrammeEnrollmentStatus.ACTIVE,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  programme: {
    id: "a22d7a09-058a-4cc7-844e-345963631882",
    code: "BSC-CS",
    name: "Computer Science",
    durationYears: 2,
  },
  admissionIntake: {
    id: INTAKE_ID,
    sequence: 3,
    academicYearId: YEAR_ONE_ID,
    academicYear: { id: YEAR_ONE_ID, label: "2026/2027" },
  },
};

const makeProgressionContext = (
  current: ProgrammeEnrollmentRecord = enrollment,
): EnrollmentProgressionContext => ({
  enrollment: current,
  intake: {
    id: INTAKE_ID,
    sequence: current.currentIntakeSlot,
    status: IntakeStatus.CLOSED,
    academicYearId: current.currentStudyYear === 1 ? YEAR_ONE_ID : YEAR_TWO_ID,
  },
  registrationStatus: IntakeRegistrationStatus.REGISTERED,
  academicYearIds: [YEAR_ONE_ID, YEAR_TWO_ID],
});

const repositoryMock = {
  advanceAfterIntake: vi.fn<ProgrammeEnrollmentsRepository["advanceAfterIntake"]>(),
  findById: vi.fn<ProgrammeEnrollmentsRepository["findById"]>(),
  findProgressionContext: vi.fn<ProgrammeEnrollmentsRepository["findProgressionContext"]>(),
  findStudentOwner: vi.fn<ProgrammeEnrollmentsRepository["findStudentOwner"]>(),
  findUserStatus: vi.fn<ProgrammeEnrollmentsRepository["findUserStatus"]>(),
  listForStudent: vi.fn<ProgrammeEnrollmentsRepository["listForStudent"]>(),
  transitionStatus: vi.fn<ProgrammeEnrollmentsRepository["transitionStatus"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};

describe("ProgrammeEnrollmentService", () => {
  let service: ProgrammeEnrollmentService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositoryMock.findUserStatus.mockResolvedValue(UserStatus.ACTIVE);
    repositoryMock.findStudentOwner.mockResolvedValue(STUDENT_USER_ID);
    repositoryMock.listForStudent.mockResolvedValue([enrollment]);
    repositoryMock.findById.mockResolvedValue(enrollment);
    repositoryMock.findProgressionContext.mockResolvedValue(makeProgressionContext());
    repositoryMock.transitionStatus.mockResolvedValue({
      ...enrollment,
      status: ProgrammeEnrollmentStatus.DEFERRED,
    });
    repositoryMock.advanceAfterIntake.mockResolvedValue({
      ...enrollment,
      currentStudyYear: 2,
      currentIntakeSlot: 1,
    });
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:enrollment:manage"],
    });
    service = new ProgrammeEnrollmentService(
      repositoryMock as unknown as ProgrammeEnrollmentsRepository,
      rbacMock as unknown as RbacService,
    );
  });

  it("returns all enrollment history for a registrar", async () => {
    // Arrange: the actor has enrollment-management scope.

    // Act: retrieve the student's history.
    const result = await service.getEnrollmentHistory(STUDENT_ID, ACTOR_ID);

    // Assert: all historical and current enrollment rows are returned.
    expect(result).toEqual([enrollment]);
    expect(repositoryMock.listForStudent).toHaveBeenCalledWith(STUDENT_ID);
  });

  it("restricts own-history reads to the authenticated student", async () => {
    // Arrange: the student has own-enrollment read permission but is not the profile owner.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:enrollment:read_own"],
    });

    // Act / Assert: reject access to another student's enrollment records.
    await expect(service.getEnrollmentHistory(STUDENT_ID, ACTOR_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repositoryMock.listForStudent).not.toHaveBeenCalled();
  });

  it("defers an active enrollment without deleting its history", async () => {
    // Arrange: the target enrollment is currently active.

    // Act: defer it with an explanation.
    const result = await service.defer({
      enrollmentId: ENROLLMENT_ID,
      actorId: ACTOR_ID,
      reason: "Approved leave.",
    });

    // Assert: the repository records a status transition, not a row deletion.
    expect(result.status).toBe(ProgrammeEnrollmentStatus.DEFERRED);
    expect(repositoryMock.transitionStatus).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      expectedStatuses: [ProgrammeEnrollmentStatus.ACTIVE],
      nextStatus: ProgrammeEnrollmentStatus.DEFERRED,
      actorId: ACTOR_ID,
      reason: "Approved leave.",
    });
  });

  it("advances slot three to slot one of the next study year after intake closure", async () => {
    // Arrange: the current registered intake is closed and matches year one, slot three.

    // Act: progress the enrollment.
    const result = await service.progressAfterIntake(ENROLLMENT_ID, INTAKE_ID, ACTOR_ID);

    // Assert: year and slot advance atomically and the enrollment remains active.
    expect(repositoryMock.advanceAfterIntake).toHaveBeenCalledWith({
      enrollmentId: ENROLLMENT_ID,
      intakeId: INTAKE_ID,
      currentStudyYear: 1,
      currentIntakeSlot: 3,
      nextStudyYear: 2,
      nextIntakeSlot: 1,
      nextStatus: ProgrammeEnrollmentStatus.ACTIVE,
      actorId: ACTOR_ID,
    });
    expect(result.currentStudyYear).toBe(2);
    expect(result.currentIntakeSlot).toBe(1);
  });

  it("completes the enrollment after its final programme intake", async () => {
    // Arrange: the final study year and slot are registered and their intake is closed.
    const finalYearEnrollment = {
      ...enrollment,
      currentStudyYear: 2,
      currentIntakeSlot: 3,
    };
    repositoryMock.findProgressionContext.mockResolvedValue(
      makeProgressionContext(finalYearEnrollment),
    );
    repositoryMock.advanceAfterIntake.mockResolvedValue({
      ...finalYearEnrollment,
      status: ProgrammeEnrollmentStatus.COMPLETED,
    });

    // Act: progress from the final intake.
    const result = await service.progressAfterIntake(ENROLLMENT_ID, INTAKE_ID, ACTOR_ID);

    // Assert: no nonexistent year-three slot is created.
    expect(repositoryMock.advanceAfterIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStudyYear: 2,
        nextIntakeSlot: 3,
        nextStatus: ProgrammeEnrollmentStatus.COMPLETED,
      }),
    );
    expect(result.status).toBe(ProgrammeEnrollmentStatus.COMPLETED);
  });

  it("does not progress before the intake is closed", async () => {
    // Arrange: the intake is still active.
    repositoryMock.findProgressionContext.mockResolvedValue({
      ...makeProgressionContext(),
      intake: {
        id: INTAKE_ID,
        sequence: 3,
        status: IntakeStatus.ACTIVE,
        academicYearId: YEAR_ONE_ID,
      },
    });

    // Act / Assert: require closure before completing a registration or moving progress.
    await expect(
      service.progressAfterIntake(ENROLLMENT_ID, INTAKE_ID, ACTOR_ID),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repositoryMock.advanceAfterIntake).not.toHaveBeenCalled();
  });
});
