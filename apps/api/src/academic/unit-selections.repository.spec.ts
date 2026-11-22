// Purpose: Verify transactional unit-registration writes and override auditing.
import { DeliveryMode, IntakeStatus, UnitRegistrationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { UnitSelectionsRepository } from "./unit-selections.repository.js";

const STUDENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ACTOR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const INTAKE_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const YEAR_ID = "9214dfac-6bcf-4dcf-90b0-2734295ee52a";
const PROGRAMME_ID = "e8f80e2c-f7a1-4aae-aee9-975505d38742";
const CORE_UNIT_ID = "d8cc759b-5cae-4332-b515-556340c5e1e9";
const OFFERING_ID = "bc02382e-8eac-4aa3-8701-46c813b5bbbd";
const NOW = new Date("2026-11-22T12:00:00.000Z");

const registration = {
  id: "44beb9c9-a002-483c-a243-730321e4d6c3",
  studentId: STUDENT_ID,
  offeringId: OFFERING_ID,
  intakeId: INTAKE_ID,
  status: UnitRegistrationStatus.SELECTED,
  isRetake: false,
  selectedAt: NOW,
};

const transactionMock = {
  $queryRaw: vi.fn(),
  academicYear: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
  courseUnitOffering: { findMany: vi.fn() },
  intake: { findFirst: vi.fn() },
  programmeCourseUnit: { findMany: vi.fn() },
  programmeElectiveRule: { findMany: vi.fn() },
  programmeEnrollment: { findMany: vi.fn() },
  student: { findUnique: vi.fn() },
  unitRegistration: {
    createMany: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    groupBy: vi.fn(),
    updateMany: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(async (work: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
    work(transactionMock as unknown as Prisma.TransactionClient),
  ),
};

describe("UnitSelectionsRepository", () => {
  let repository: UnitSelectionsRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.$queryRaw.mockResolvedValue([]);
    transactionMock.student.findUnique.mockResolvedValue({
      id: STUDENT_ID,
      userId: STUDENT_USER_ID,
      user: { status: "ACTIVE" },
    });
    transactionMock.intake.findFirst.mockResolvedValue({
      id: INTAKE_ID,
      academicYearId: YEAR_ID,
      sequence: 1,
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      selectionOpensAt: new Date("2026-11-01T00:00:00.000Z"),
      selectionClosesAt: new Date("2026-12-01T00:00:00.000Z"),
      status: IntakeStatus.SELECTION_OPEN,
    });
    transactionMock.programmeEnrollment.findMany.mockResolvedValue([
      {
        id: "deff99aa-fd92-4eeb-a91c-29598e1cf9bd",
        programmeId: PROGRAMME_ID,
        currentStudyYear: 1,
        currentIntakeSlot: 1,
        admissionIntake: { academicYearId: YEAR_ID },
        programme: {
          deletedAt: null,
          durationYears: 4,
          department: {
            deletedAt: null,
            facultyId: "2215dfac-62d3-4aae-aee9-975505d38742",
            faculty: { deletedAt: null },
          },
        },
      },
    ]);
    transactionMock.academicYear.findMany.mockResolvedValue([{ id: YEAR_ID }]);
    transactionMock.programmeCourseUnit.findMany.mockResolvedValue([
      {
        courseUnitId: CORE_UNIT_ID,
        type: "CORE",
        courseUnit: {
          id: CORE_UNIT_ID,
          code: "CORE101",
          name: "Core course",
          creditUnits: 3,
          status: "ACTIVE",
          isGeneral: false,
          openToAllFaculties: false,
          ownerDepartment: { facultyId: "2215dfac-62d3-4aae-aee9-975505d38742" },
          facultyEligibilities: [],
          prerequisites: [],
        },
      },
    ]);
    transactionMock.programmeElectiveRule.findMany.mockResolvedValue([]);
    transactionMock.unitRegistration.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([registration]);
    transactionMock.unitRegistration.groupBy.mockResolvedValue([]);
    transactionMock.courseUnitOffering.findMany.mockResolvedValue([
      {
        id: OFFERING_ID,
        courseUnitId: CORE_UNIT_ID,
        intakeId: INTAKE_ID,
        capacity: 10,
        deliveryMode: DeliveryMode.PHYSICAL,
        status: "OPEN",
        createdAt: NOW,
        updatedAt: NOW,
        courseUnit: {
          id: CORE_UNIT_ID,
          code: "CORE101",
          name: "Core course",
          creditUnits: 3,
          status: "ACTIVE",
          isGeneral: false,
          openToAllFaculties: false,
          ownerDepartment: { facultyId: "2215dfac-62d3-4aae-aee9-975505d38742" },
          facultyEligibilities: [],
          prerequisites: [],
        },
        lecturers: [],
        classSessions: [],
        timetableSlots: [],
      },
    ]);
    transactionMock.unitRegistration.createMany.mockResolvedValue({ count: 1 });
    transactionMock.unitRegistration.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.unitRegistration.findUnique.mockResolvedValue({
      ...registration,
      status: UnitRegistrationStatus.DROPPED,
    });
    transactionMock.auditLog.create.mockResolvedValue({});
    repository = new UnitSelectionsRepository(prismaMock as unknown as PrismaService);
  });

  it("commits unit rows and override audit together in one serializable transaction", async () => {
    // Arrange: the enrollment, core offering, and student are valid.
    const validate = vi.fn();

    // Act: persist a selection override with its written reason.
    const result = await repository.selectUnits(
      {
        studentId: STUDENT_ID,
        intakeId: INTAKE_ID,
        offeringIds: [OFFERING_ID],
        actorId: ACTOR_ID,
        selectedAt: NOW,
        overrideReason: "Approved late registration.",
      },
      validate,
    );

    // Assert: validation, registration creation, and audit all run through the same transaction.
    expect(result).toEqual([registration]);
    expect(validate).toHaveBeenCalledOnce();
    expect(transactionMock.unitRegistration.createMany).toHaveBeenCalledWith({
      data: [
        {
          studentId: STUDENT_ID,
          offeringId: OFFERING_ID,
          intakeId: INTAKE_ID,
          status: UnitRegistrationStatus.SELECTED,
          isRetake: false,
          selectedAt: NOW,
        },
      ],
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ACTOR_ID,
        action: "academic.unit_selection.overridden",
        resourceType: "student_intake_unit_selection",
        resourceId: STUDENT_ID,
        reason: "Approved late registration.",
        metadata: {
          intakeId: INTAKE_ID,
          offeringIds: [OFFERING_ID],
          bypassed: ["selection_window"],
        },
      }),
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("marks a unit registration dropped without deleting its history", async () => {
    // Arrange: the student has one selected offering in the intake.
    transactionMock.unitRegistration.findMany
      .mockReset()
      .mockResolvedValueOnce([
        {
          ...registration,
          offering: { courseUnitId: CORE_UNIT_ID },
        },
      ])
      .mockResolvedValueOnce([]);
    const validate = vi.fn();

    // Act: change the registration status inside the repository transaction.
    const result = await repository.dropUnit(
      { studentId: STUDENT_ID, intakeId: INTAKE_ID, offeringId: OFFERING_ID },
      validate,
    );

    // Assert: history is preserved by updating the status, not deleting the row.
    expect(result).toEqual({ ...registration, status: UnitRegistrationStatus.DROPPED });
    expect(transactionMock.unitRegistration.updateMany).toHaveBeenCalledWith({
      where: {
        id: registration.id,
        status: UnitRegistrationStatus.SELECTED,
      },
      data: { status: UnitRegistrationStatus.DROPPED },
    });
    expect(transactionMock.unitRegistration.findUnique).toHaveBeenCalledOnce();
    expect(transactionMock.unitRegistration.delete).not.toHaveBeenCalled();
  });
});
