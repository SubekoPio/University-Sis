// Purpose: Test student profile permissions, pagination, archival, and study-mode changes.
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ApplicationStatus, Prisma, StudentSchedule, StudyMode, UserStatus } from "@prisma/client";
import type { AdmissionRecord, Student } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { StudentsRepository } from "./students.repository.js";
import type { ChangedStudyMode, StudentProfile } from "./students.repository.js";
import { StudentsService } from "./students.service.js";
import type { CreateStudentProfileForAdmissionInput } from "./sis.types.js";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const STUDENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ACTOR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const APPLICATION_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const TRANSACTION = null as unknown as Prisma.TransactionClient;
const DATE_OF_BIRTH = new Date("2005-04-15T00:00:00.000Z");

const studentRecord: Student = {
  id: STUDENT_ID,
  userId: STUDENT_USER_ID,
  studentNumber: "SIS-123",
  phone: "+256700000000",
  dateOfBirth: DATE_OF_BIRTH,
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

const studentProfile: StudentProfile = {
  ...studentRecord,
  user: {
    id: STUDENT_USER_ID,
    name: "Avery Student",
    email: "avery@example.test",
    status: UserStatus.ACTIVE,
  },
};

const admissionRecord: AdmissionRecord = {
  id: "9214dfac-6bcf-4dcf-90b0-2734295ee52a",
  applicationId: APPLICATION_ID,
  studentId: STUDENT_ID,
  programmeId: "e8f80e2c-f7a1-4aae-aee9-975505d38742",
  admissionIntakeId: "2215dfac-6bcf-4dcf-90b0-2734295ee52a",
  studyMode: StudyMode.ONLINE,
  schedule: StudentSchedule.DAY,
  admittedById: ACTOR_ID,
  admittedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const changedStudyMode: ChangedStudyMode = {
  kind: "changed",
  admission: {
    ...admissionRecord,
    application: {
      id: APPLICATION_ID,
      status: ApplicationStatus.ADMITTED,
      studentId: STUDENT_ID,
      studyMode: StudyMode.ONLINE,
    },
    student: { user: { status: UserStatus.ACTIVE } },
  },
  previousMode: StudyMode.PHYSICAL,
};

const repositoryMock = {
  archive: vi.fn<StudentsRepository["archive"]>(),
  changeStudyMode: vi.fn<StudentsRepository["changeStudyMode"]>(),
  createProfileForAdmission: vi.fn<StudentsRepository["createProfileForAdmission"]>(),
  findArchiveTarget: vi.fn<StudentsRepository["findArchiveTarget"]>(),
  findById: vi.fn<StudentsRepository["findById"]>(),
  findUserStatus: vi.fn<StudentsRepository["findUserStatus"]>(),
  list: vi.fn<StudentsRepository["list"]>(),
  update: vi.fn<StudentsRepository["update"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
  invalidateAuthorizationSnapshot: vi.fn<RbacService["invalidateAuthorizationSnapshot"]>(),
};

describe("StudentsService", () => {
  let service: StudentsService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositoryMock.findUserStatus.mockResolvedValue(UserStatus.ACTIVE);
    repositoryMock.createProfileForAdmission.mockResolvedValue(studentRecord);
    repositoryMock.findById.mockResolvedValue(studentProfile);
    repositoryMock.findArchiveTarget.mockResolvedValue({
      userId: STUDENT_USER_ID,
      status: UserStatus.ACTIVE,
    });
    repositoryMock.list.mockResolvedValue({ students: [studentProfile], total: 1 });
    repositoryMock.update.mockResolvedValue(studentProfile);
    repositoryMock.archive.mockResolvedValue(STUDENT_USER_ID);
    repositoryMock.changeStudyMode.mockResolvedValue(changedStudyMode);
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({ roles: [], permissions: [] });
    service = new StudentsService(
      repositoryMock as unknown as StudentsRepository,
      rbacMock as unknown as RbacService,
    );
  });

  it("creates profiles only through the admission permission and transaction", async () => {
    // Arrange: the actor can create a student profile after admission.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["sis:student:create_after_admission"],
    });
    const input: CreateStudentProfileForAdmissionInput = {
      userId: STUDENT_USER_ID,
      studentNumber: " sis-123 ",
      phone: " +256700000000 ",
      dateOfBirth: DATE_OF_BIRTH,
      nationality: " Ugandan ",
      schedule: StudentSchedule.DAY,
    };

    // Act: create the profile using the caller-owned transaction.
    const result = await service.createProfileForAdmission(TRANSACTION, input, ACTOR_ID);

    // Assert: identifiers and required text are normalized before persistence.
    expect(result).toBe(studentRecord);
    expect(repositoryMock.createProfileForAdmission).toHaveBeenCalledWith(
      TRANSACTION,
      {
        ...input,
        studentNumber: "SIS-123",
        phone: "+256700000000",
        nationality: "Ugandan",
      },
      ACTOR_ID,
    );
  });

  it("searches and paginates student profiles with the requested bounds", async () => {
    // Arrange: grant full student-read permission and request the second page.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["sis:student:read"],
    });

    // Act: list a trimmed search on page two.
    const result = await service.listStudents(
      { search: " Avery ", page: 2, pageSize: 10 },
      ACTOR_ID,
    );

    // Assert: the repository receives normalized search and offset pagination.
    expect(result).toEqual({ students: [studentProfile], total: 1, page: 2, pageSize: 10 });
    expect(repositoryMock.list).toHaveBeenCalledWith({
      search: "Avery",
      skip: 10,
      take: 10,
    });
  });

  it("restricts student self-service listing to the authenticated profile", async () => {
    // Arrange: grant only the own-profile read permission.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["sis:student:read_own"],
    });

    // Act: list the caller's own profile.
    await service.listStudents({}, STUDENT_USER_ID);

    // Assert: the data query is scoped to the caller, not a client-supplied user ID.
    expect(repositoryMock.list).toHaveBeenCalledWith({
      skip: 0,
      take: 25,
      userId: STUDENT_USER_ID,
    });
  });

  it("prevents student self-service from changing non-contact profile fields", async () => {
    // Arrange: the actor has own-contact permission but asks to alter their student number.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["sis:student:update_contact_own"],
    });

    // Act / Assert: deny the operation before persistence.
    await expect(
      service.updateStudent(STUDENT_ID, { studentNumber: "SIS-999" }, STUDENT_USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositoryMock.update).not.toHaveBeenCalled();
  });

  it("archives by deactivating the account and invalidates its permission cache", async () => {
    // Arrange: the registrar can archive another student's account.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["sis:student:archive"],
    });

    // Act: archive the profile.
    await service.archiveStudent(STUDENT_ID, ACTOR_ID);

    // Assert: the account is deactivated transactionally, and its cached permissions are cleared.
    expect(repositoryMock.archive).toHaveBeenCalledWith(STUDENT_ID, ACTOR_ID, expect.any(Date));
    expect(rbacMock.invalidateAuthorizationSnapshot).toHaveBeenCalledWith(STUDENT_USER_ID);
  });

  it("requires an admissions-head permission and reason for a study-mode change", async () => {
    // Arrange: grant the existing study-mode permission.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["admissions:study-mode:change"],
    });

    // Act: change the admitted mode with a written reason.
    const result = await service.changeStudyMode(
      { applicationId: APPLICATION_ID, studyMode: StudyMode.ONLINE, reason: "Approved request." },
      ACTOR_ID,
    );

    // Assert: the repository receives the actor and normalized audit reason.
    expect(result).toEqual(changedStudyMode);
    expect(repositoryMock.changeStudyMode).toHaveBeenCalledWith(
      APPLICATION_ID,
      StudyMode.ONLINE,
      ACTOR_ID,
      "Approved request.",
    );
    await expect(
      service.changeStudyMode(
        { applicationId: APPLICATION_ID, studyMode: StudyMode.ONLINE, reason: "  " },
        ACTOR_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects duplicate student numbers and national IDs", async () => {
    // Arrange: Prisma reports a unique-key violation during profile update.
    repositoryMock.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["sis:student:update"],
    });

    // Act / Assert: the service returns a conflict rather than exposing a database error.
    await expect(
      service.updateStudent(STUDENT_ID, { studentNumber: "SIS-123" }, ACTOR_ID),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
