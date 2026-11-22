// Purpose: Test prompted units, selection rules, ownership, and registrar overrides.
import { ForbiddenException } from "@nestjs/common";
import {
  CourseUnitOfferingStatus,
  DeliveryMode,
  IntakeStatus,
  UnitRegistrationStatus,
  UserStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { HomeCacheService } from "./home-cache.service.js";
import { UnitSelectionService } from "./unit-selection.service.js";
import type {
  UnitSelectionOfferingRecord,
  UnitSelectionSnapshot,
  UnitSelectionsRepository,
} from "./unit-selections.repository.js";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const STUDENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const REGISTRAR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const INTAKE_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const YEAR_ID = "9214dfac-6bcf-4dcf-90b0-2734295ee52a";
const PROGRAMME_ID = "e8f80e2c-f7a1-4aae-aee9-975505d38742";
const FACULTY_ID = "2215dfac-6bcf-4dcf-90b0-2734295ee52b";
const CORE_UNIT_ID = "d8cc759b-5cae-4332-b515-556340c5e1e9";
const ELECTIVE_UNIT_ID = "fe8499a8-28f1-4156-8055-163a94f35183";
const ELECTIVE_TWO_UNIT_ID = "3b04dbf1-09a3-4b6a-9b22-1239ea192318";
const GENERAL_UNIT_ID = "d91dd239-28fd-47ac-b9ad-3d37aad583e1";
const CORE_OFFERING_ID = "bc02382e-8eac-4aa3-8701-46c813b5bbbd";
const ELECTIVE_OFFERING_ID = "c6f13105-6686-46ef-a35f-86e7cb2bca64";
const ELECTIVE_TWO_OFFERING_ID = "4f85ee14-f270-444a-9cb8-ff6da5a31585";
const GENERAL_OFFERING_ID = "ad85fb39-d64d-4c28-9c44-ea38bfc1432a";
const PREREQUISITE_ID = "66c4e15b-1e9a-4e56-8ca1-6effd6d3e64a";
const LAW_FACULTY_ID = "1bb37a0e-a77e-4f67-ae5d-3f8eb4e43e21";
const CS_ONLY_UNIT_ID = "7a7a14db-52ae-47e6-8f7c-d6ef02d8cc3e";
const CS_ONLY_OFFERING_ID = "58ecdb4d-bcf4-44bc-b822-3df4f9d6c4df";

const makeOffering = (input: {
  id: string;
  courseUnitId: string;
  code: string;
  isGeneral?: boolean;
  openToAllFaculties?: boolean;
  facultyIds?: string[];
  prerequisites?: string[];
  capacity?: number | null;
  status?: CourseUnitOfferingStatus;
  timetableSlots?: UnitSelectionOfferingRecord["timetableSlots"];
  classSessions?: UnitSelectionOfferingRecord["classSessions"];
  lecturers?: UnitSelectionOfferingRecord["lecturers"];
}): UnitSelectionOfferingRecord => ({
  id: input.id,
  courseUnitId: input.courseUnitId,
  intakeId: INTAKE_ID,
  capacity: input.capacity === undefined ? 10 : input.capacity,
  deliveryMode: DeliveryMode.PHYSICAL,
  status: input.status ?? CourseUnitOfferingStatus.OPEN,
  createdAt: NOW,
  updatedAt: NOW,
  courseUnit: {
    id: input.courseUnitId,
    code: input.code,
    name: `${input.code} course unit`,
    creditUnits: 3,
    status: "ACTIVE",
    isGeneral: input.isGeneral ?? false,
    openToAllFaculties: input.openToAllFaculties ?? false,
    ownerDepartment: { facultyId: FACULTY_ID },
    facultyEligibilities: (input.facultyIds ?? []).map((facultyId) => ({ facultyId })),
    prerequisites: (input.prerequisites ?? []).map((prerequisiteId) => ({ prerequisiteId })),
  },
  lecturers: input.lecturers ?? [],
  classSessions: input.classSessions ?? [],
  timetableSlots: input.timetableSlots ?? [],
});

const coreOffering = makeOffering({
  id: CORE_OFFERING_ID,
  courseUnitId: CORE_UNIT_ID,
  code: "CORE101",
  capacity: 5,
  lecturers: [
    {
      lecturer: {
        id: "987a3c4d-77de-4e67-91b1-67b97c4acdef",
        staffNumber: "LEC-10",
        user: { id: "c4c57fa1-0f20-4ce2-a283-563b68c50e6a", name: "Primary Lecturer" },
      },
    },
  ],
  classSessions: [
    {
      id: "44beb9c9-a002-483c-a243-730321e4d6c3",
      startsAt: new Date("2026-12-01T09:00:00.000Z"),
      endsAt: new Date("2026-12-01T10:00:00.000Z"),
      deliveryMode: DeliveryMode.PHYSICAL,
      room: "A101",
    },
  ],
  timetableSlots: [
    {
      dayOfWeek: "MONDAY",
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T10:00:00.000Z"),
    },
  ],
});
const electiveOffering = makeOffering({
  id: ELECTIVE_OFFERING_ID,
  courseUnitId: ELECTIVE_UNIT_ID,
  code: "ELC101",
  timetableSlots: [
    {
      dayOfWeek: "FRIDAY",
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T10:00:00.000Z"),
    },
  ],
});
const electiveTwoOffering = makeOffering({
  id: ELECTIVE_TWO_OFFERING_ID,
  courseUnitId: ELECTIVE_TWO_UNIT_ID,
  code: "ELC102",
  timetableSlots: [
    {
      dayOfWeek: "WEDNESDAY",
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T10:00:00.000Z"),
    },
  ],
});
const generalOffering = makeOffering({
  id: GENERAL_OFFERING_ID,
  courseUnitId: GENERAL_UNIT_ID,
  code: "GEN101",
  isGeneral: true,
  openToAllFaculties: true,
  capacity: null,
});

const makeSnapshot = (): UnitSelectionSnapshot => ({
  student: { id: STUDENT_ID, userId: STUDENT_USER_ID, userStatus: UserStatus.ACTIVE },
  intake: {
    id: INTAKE_ID,
    academicYearId: YEAR_ID,
    sequence: 1,
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    selectionOpensAt: new Date("2026-11-01T00:00:00.000Z"),
    selectionClosesAt: new Date("2026-12-01T00:00:00.000Z"),
    status: IntakeStatus.SELECTION_OPEN,
  },
  activeEnrollments: [
    {
      id: "deff99aa-fd92-4eeb-a91c-29598e1cf9bd",
      programmeId: PROGRAMME_ID,
      currentStudyYear: 1,
      currentIntakeSlot: 1,
      admissionAcademicYearId: YEAR_ID,
      programme: {
        deletedAt: null,
        durationYears: 4,
        department: {
          deletedAt: null,
          facultyId: FACULTY_ID,
          faculty: { deletedAt: null },
        },
      },
    },
  ],
  academicYearIds: [YEAR_ID],
  curriculumEntries: [
    {
      courseUnitId: CORE_UNIT_ID,
      type: "CORE",
      courseUnit: coreOffering.courseUnit,
    },
    {
      courseUnitId: ELECTIVE_UNIT_ID,
      type: "ELECTIVE",
      courseUnit: electiveOffering.courseUnit,
    },
    {
      courseUnitId: ELECTIVE_TWO_UNIT_ID,
      type: "ELECTIVE",
      courseUnit: electiveTwoOffering.courseUnit,
    },
  ],
  electiveRules: [{ minCredits: 3, maxCredits: 6 }],
  offerings: [coreOffering, electiveOffering, electiveTwoOffering, generalOffering],
  registrations: [],
  completedUnitIds: [],
  selectedCounts: new Map([
    [CORE_OFFERING_ID, 0],
    [ELECTIVE_OFFERING_ID, 0],
    [ELECTIVE_TWO_OFFERING_ID, 0],
    [GENERAL_OFFERING_ID, 0],
  ]),
});

const getSnapshotIntake = (selectionSnapshot: UnitSelectionSnapshot) => {
  const intake = selectionSnapshot.intake;
  if (intake === null) {
    throw new Error("The unit-selection fixture must include an intake.");
  }
  return intake;
};

const repositoryMock = {
  dropUnit: vi.fn<UnitSelectionsRepository["dropUnit"]>(),
  findUserStatus: vi.fn<UnitSelectionsRepository["findUserStatus"]>(),
  getSnapshot: vi.fn<UnitSelectionsRepository["getSnapshot"]>(),
  selectUnits: vi.fn<UnitSelectionsRepository["selectUnits"]>(),
};
const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};
const homeCacheMock = {
  invalidateUser: vi.fn<HomeCacheService["invalidateUser"]>(),
};

describe("UnitSelectionService", () => {
  let service: UnitSelectionService;
  let snapshot: UnitSelectionSnapshot;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    snapshot = makeSnapshot();
    repositoryMock.findUserStatus.mockResolvedValue(UserStatus.ACTIVE);
    repositoryMock.getSnapshot.mockImplementation(async () => snapshot);
    repositoryMock.selectUnits.mockImplementation(async (_input, validate) => {
      validate(snapshot);
      return [];
    });
    repositoryMock.dropUnit.mockImplementation(async (_input, validate) => {
      validate(snapshot);
      return null;
    });
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["student"],
      permissions: ["academic:unit:select"],
    });
    homeCacheMock.invalidateUser.mockResolvedValue();
    service = new UnitSelectionService(
      repositoryMock as unknown as UnitSelectionsRepository,
      rbacMock as unknown as RbacService,
      homeCacheMock as unknown as HomeCacheService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns required core, elective, and faculty-general prompts with lecturer and seat details", async () => {
    // Arrange: the intake has one primary lecturer, a capacity-limited core, and an open general unit.

    // Act: load the student's prompted units.
    const result = await service.getPromptedUnits(STUDENT_ID, INTAKE_ID, STUDENT_USER_ID);

    // Assert: core is preselected and session output does not expose a meeting URL.
    expect(result.core).toHaveLength(1);
    expect(result.core[0]).toMatchObject({
      preselected: true,
      currentlySelected: false,
      offering: {
        seatsLeft: 5,
        primaryLecturer: { staffNumber: "LEC-10" },
        sessions: [
          {
            id: "44beb9c9-a002-483c-a243-730321e4d6c3",
            room: "A101",
          },
        ],
      },
    });
    expect(result.core[0]?.offering.sessions[0]).not.toHaveProperty("meetingUrl");
    expect(result.electives).toHaveLength(2);
    expect(result.generalUnits).toHaveLength(1);
    expect(result.retakes).toEqual([]);
    expect(result.electiveCreditRules).toEqual([{ minCredits: 3, maxCredits: 6 }]);
  });

  it("allows a Law student to see a general unit but excludes a Computer Science-only unit", async () => {
    // Arrange: the student belongs to Law while the restricted unit belongs only to Computer Science.
    const activeEnrollment = snapshot.activeEnrollments[0];
    if (activeEnrollment === undefined) {
      throw new Error("The unit-selection fixture must include an active enrollment.");
    }
    activeEnrollment.programme.department.facultyId = LAW_FACULTY_ID;
    snapshot.offerings.push(
      makeOffering({
        id: CS_ONLY_OFFERING_ID,
        courseUnitId: CS_ONLY_UNIT_ID,
        code: "CS-ONLY101",
        isGeneral: true,
        openToAllFaculties: false,
        facultyIds: [FACULTY_ID],
      }),
    );

    // Act: load prompts for the Law student.
    const result = await service.getPromptedUnits(STUDENT_ID, INTAKE_ID, STUDENT_USER_ID);

    // Assert: the open general unit is available and the faculty-restricted unit is absent.
    expect(result.generalUnits.map(({ offering }) => offering.id)).toContain(GENERAL_OFFERING_ID);
    expect(result.generalUnits.map(({ offering }) => offering.id)).not.toContain(
      CS_ONLY_OFFERING_ID,
    );

    // Act / Assert: a direct selection also fails at the eligibility boundary.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID, CS_ONLY_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "UNIT_NOT_ELIGIBLE" });
  });

  it("requires compulsory core units in the resulting selection", async () => {
    // Arrange: only an elective is requested even though the required core is not selected.

    // Act / Assert: expose a stable rule reason without writing registrations.
    await expect(
      service.selectUnits(STUDENT_ID, INTAKE_ID, [ELECTIVE_OFFERING_ID], STUDENT_USER_ID),
    ).rejects.toMatchObject({ reason: "CORE_UNITS_REQUIRED" });
  });

  it("checks prerequisites against completed units from earlier intakes", async () => {
    // Arrange: a general unit requires a prerequisite absent from completed registrations.
    snapshot.offerings.push(
      makeOffering({
        id: GENERAL_OFFERING_ID,
        courseUnitId: GENERAL_UNIT_ID,
        code: "GEN101",
        isGeneral: true,
        openToAllFaculties: true,
        capacity: null,
        prerequisites: [PREREQUISITE_ID],
      }),
    );

    // Act / Assert: reject the choice with a typed prerequisite reason.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, GENERAL_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "PREREQUISITE_NOT_MET" });
  });

  it("enforces capacity and timetable clashes", async () => {
    // Arrange: fill the elective offering while keeping the core available.
    snapshot.selectedCounts.set(ELECTIVE_OFFERING_ID, 10);
    snapshot.offerings = snapshot.offerings.map((offering) =>
      offering.id === ELECTIVE_OFFERING_ID ? { ...offering, capacity: 10 } : offering,
    );

    // Act / Assert: a full offering cannot be selected.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "CAPACITY_EXCEEDED" });

    // Arrange: restore capacity and overlap the elective with the core's recurring slot.
    snapshot.selectedCounts.set(ELECTIVE_OFFERING_ID, 0);
    snapshot.offerings = snapshot.offerings.map((offering) =>
      offering.id === ELECTIVE_OFFERING_ID
        ? {
            ...offering,
            timetableSlots: coreOffering.timetableSlots,
          }
        : offering,
    );

    // Act / Assert: a recurring timetable conflict is rejected.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "TIMETABLE_CLASH" });

    // Arrange: an individual session overlaps the core unit's recurring weekly slot.
    snapshot.offerings = snapshot.offerings.map((offering) =>
      offering.id === ELECTIVE_OFFERING_ID
        ? {
            ...offering,
            timetableSlots: [],
            classSessions: [
              {
                id: "4e4b2439-8ea4-41bf-9067-61988cf8b2f6",
                startsAt: new Date("2026-11-23T09:30:00.000Z"),
                endsAt: new Date("2026-11-23T10:30:00.000Z"),
                deliveryMode: DeliveryMode.PHYSICAL,
                room: "B201",
              },
            ],
          }
        : offering,
    );

    // Act / Assert: dated sessions are compared against recurring timetable slots too.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "TIMETABLE_CLASH" });
  });

  it("accepts elective credits that fit any configured allowed range", async () => {
    // Arrange: two 3-credit electives satisfy the second of two alternative ranges.
    snapshot.electiveRules = [
      { minCredits: 3, maxCredits: 3 },
      { minCredits: 6, maxCredits: 6 },
    ];

    // Act: select core plus both electives.
    await service.selectUnits(
      STUDENT_ID,
      INTAKE_ID,
      [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID, ELECTIVE_TWO_OFFERING_ID],
      STUDENT_USER_ID,
    );

    // Assert: the repository receives the complete validated request.
    expect(repositoryMock.selectUnits).toHaveBeenCalledOnce();
    expect(homeCacheMock.invalidateUser).toHaveBeenCalledWith(STUDENT_USER_ID);
  });

  it("invalidates the student's home after a successful unit drop", async () => {
    // Arrange: the student selected a non-core offering before the deadline.
    snapshot.registrations = [
      {
        id: "44beb9c9-a002-483c-a243-730321e4d6c3",
        studentId: STUDENT_ID,
        offeringId: ELECTIVE_OFFERING_ID,
        intakeId: INTAKE_ID,
        status: UnitRegistrationStatus.SELECTED,
        isRetake: false,
        selectedAt: NOW,
        offering: { courseUnitId: ELECTIVE_UNIT_ID },
      },
      {
        id: "b440b255-eefd-4f52-ab68-0b65846b8f1b",
        studentId: STUDENT_ID,
        offeringId: ELECTIVE_TWO_OFFERING_ID,
        intakeId: INTAKE_ID,
        status: UnitRegistrationStatus.SELECTED,
        isRetake: false,
        selectedAt: NOW,
        offering: { courseUnitId: ELECTIVE_TWO_UNIT_ID },
      },
    ];
    const dropped = {
      id: "44beb9c9-a002-483c-a243-730321e4d6c3",
      studentId: STUDENT_ID,
      offeringId: ELECTIVE_OFFERING_ID,
      intakeId: INTAKE_ID,
      status: UnitRegistrationStatus.DROPPED,
      isRetake: false,
      selectedAt: NOW,
    };
    repositoryMock.dropUnit.mockImplementation(async (_input, validate) => {
      validate(snapshot);
      return dropped;
    });

    // Act: drop the selected offering.
    await service.dropUnit(STUDENT_ID, INTAKE_ID, ELECTIVE_OFFERING_ID, STUDENT_USER_ID);

    // Assert: the affected student's cached home view is invalidated.
    expect(homeCacheMock.invalidateUser).toHaveBeenCalledWith(STUDENT_USER_ID);
  });

  it("rejects selections that fail an elective minimum credit rule", async () => {
    // Arrange: the slot requires at least three elective credits, but only core is requested.

    // Act / Assert: core-only selection does not bypass the configured minimum.
    await expect(
      service.selectUnits(STUDENT_ID, INTAKE_ID, [CORE_OFFERING_ID], STUDENT_USER_ID),
    ).rejects.toMatchObject({ reason: "ELECTIVE_CREDIT_RULE_NOT_MET" });
  });

  it("rejects general units outside the student's faculty allowlist", async () => {
    // Arrange: a general unit is restricted to a different faculty.
    snapshot.offerings = snapshot.offerings.map((offering) =>
      offering.id === GENERAL_OFFERING_ID
        ? {
            ...offering,
            courseUnit: {
              ...offering.courseUnit,
              openToAllFaculties: false,
              facultyEligibilities: [{ facultyId: REGISTRAR_ID }],
            },
          }
        : offering,
    );

    // Act / Assert: a general-unit selection outside the allowlist is rejected.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID, GENERAL_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "UNIT_NOT_ELIGIBLE" });
  });

  it("limits student selection to the authenticated student's own profile", async () => {
    // Arrange: the student permission is own-scoped, but the profile belongs to another user.
    snapshot.student = {
      id: STUDENT_ID,
      userId: REGISTRAR_ID,
      userStatus: UserStatus.ACTIVE,
    };

    // Act / Assert: deny the read rather than leaking prompted unit data.
    await expect(
      service.getPromptedUnits(STUDENT_ID, INTAKE_ID, STUDENT_USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects student selection after the selection window closes", async () => {
    // Arrange: close the window while keeping the intake active.
    snapshot.intake = {
      ...getSnapshotIntake(snapshot),
      selectionClosesAt: new Date("2026-11-21T00:00:00.000Z"),
    };

    // Act / Assert: students cannot select, but the repository write is never reached.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "SELECTION_WINDOW_CLOSED" });
  });

  it("allows a registrar to bypass only the selection window and records a reason", async () => {
    // Arrange: the window has closed but the intake is not closed; only the registrar permission is granted.
    snapshot.intake = {
      ...getSnapshotIntake(snapshot),
      selectionClosesAt: new Date("2026-11-21T00:00:00.000Z"),
    };
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["registrar"],
      permissions: ["academic:enrollment:manage"],
    });

    // Act: override the window with the compulsory core and an elective.
    await service.overrideSelection({
      studentId: STUDENT_ID,
      intakeId: INTAKE_ID,
      offeringIds: [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
      actorId: REGISTRAR_ID,
      reason: "Approved late registration.",
    });

    // Assert: the reason is forwarded for an atomic audit write with the selection.
    expect(repositoryMock.selectUnits).toHaveBeenCalledWith(
      expect.objectContaining({ overrideReason: "Approved late registration." }),
      expect.any(Function),
    );
  });

  it("keeps capacity validation enabled during a registrar window override", async () => {
    // Arrange: the registrar is authorized, but the elective offering is full.
    snapshot.intake = {
      ...getSnapshotIntake(snapshot),
      selectionClosesAt: new Date("2026-11-21T00:00:00.000Z"),
    };
    snapshot.selectedCounts.set(ELECTIVE_OFFERING_ID, 10);
    snapshot.offerings = snapshot.offerings.map((offering) =>
      offering.id === ELECTIVE_OFFERING_ID ? { ...offering, capacity: 10 } : offering,
    );
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["registrar"],
      permissions: ["academic:enrollment:manage"],
    });

    // Act / Assert: the override bypasses only the window, not capacity.
    await expect(
      service.overrideSelection({
        studentId: STUDENT_ID,
        intakeId: INTAKE_ID,
        offeringIds: [CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
        actorId: REGISTRAR_ID,
        reason: "Approved late registration.",
      }),
    ).rejects.toMatchObject({ reason: "CAPACITY_EXCEEDED" });
  });

  it("does not allow students to drop compulsory core units", async () => {
    // Arrange: the required core offering is selected.
    snapshot.registrations = [
      {
        id: "44beb9c9-a002-483c-a243-730321e4d6c3",
        studentId: STUDENT_ID,
        offeringId: CORE_OFFERING_ID,
        intakeId: INTAKE_ID,
        status: UnitRegistrationStatus.SELECTED,
        isRetake: false,
        selectedAt: NOW,
        offering: { courseUnitId: CORE_UNIT_ID },
      },
    ];

    // Act / Assert: the core invariant prevents the repository from dropping the registration.
    await expect(
      service.dropUnit(STUDENT_ID, INTAKE_ID, CORE_OFFERING_ID, STUDENT_USER_ID),
    ).rejects.toMatchObject({ reason: "CORE_UNIT_CANNOT_DROP" });
    expect(repositoryMock.dropUnit).toHaveBeenCalledOnce();
  });

  it("rejects drops at or after the configured deadline", async () => {
    // Arrange: a non-core unit is selected and the current time is at the close boundary.
    snapshot.registrations = [
      {
        id: "44beb9c9-a002-483c-a243-730321e4d6c3",
        studentId: STUDENT_ID,
        offeringId: ELECTIVE_OFFERING_ID,
        intakeId: INTAKE_ID,
        status: UnitRegistrationStatus.SELECTED,
        isRetake: false,
        selectedAt: NOW,
        offering: { courseUnitId: ELECTIVE_UNIT_ID },
      },
    ];
    vi.setSystemTime(getSnapshotIntake(snapshot).selectionClosesAt);

    // Act / Assert: the close boundary is exclusive for drops.
    await expect(
      service.dropUnit(STUDENT_ID, INTAKE_ID, ELECTIVE_OFFERING_ID, STUDENT_USER_ID),
    ).rejects.toMatchObject({ reason: "DROP_DEADLINE_PASSED" });
  });

  it("rejects duplicate offering IDs before entering the transaction", async () => {
    // Arrange: the request contains the same offering twice.

    // Act / Assert: return the typed duplicate reason and avoid a repository write.
    await expect(
      service.selectUnits(
        STUDENT_ID,
        INTAKE_ID,
        [CORE_OFFERING_ID, CORE_OFFERING_ID, ELECTIVE_OFFERING_ID],
        STUDENT_USER_ID,
      ),
    ).rejects.toMatchObject({ reason: "DUPLICATE_OFFERING" });
    expect(repositoryMock.selectUnits).not.toHaveBeenCalled();
  });
});
