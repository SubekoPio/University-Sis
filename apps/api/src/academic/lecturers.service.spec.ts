// Purpose: Test lecturer profile permissions, account links, and department validation.
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import type { Lecturer } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { LecturersRepository } from "./lecturers.repository.js";
import type { LecturerProfile } from "./lecturers.repository.js";
import { LecturersService } from "./lecturers.service.js";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const LECTURER_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const LECTURER_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ACTOR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const DEPARTMENT_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";

const lecturerRecord: Lecturer = {
  id: LECTURER_ID,
  userId: LECTURER_USER_ID,
  departmentId: DEPARTMENT_ID,
  staffNumber: "LEC-001",
  createdAt: NOW,
  updatedAt: NOW,
};

const lecturerProfile: LecturerProfile = {
  ...lecturerRecord,
  user: {
    id: LECTURER_USER_ID,
    name: "Taylor Lecturer",
    email: "taylor@example.test",
    status: UserStatus.ACTIVE,
  },
  department: { id: DEPARTMENT_ID, code: "SCI", name: "Science" },
};

const repositoryMock = {
  create: vi.fn<LecturersRepository["create"]>(),
  findById: vi.fn<LecturersRepository["findById"]>(),
  findUserStatus: vi.fn<LecturersRepository["findUserStatus"]>(),
  list: vi.fn<LecturersRepository["list"]>(),
  update: vi.fn<LecturersRepository["update"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};

describe("LecturersService", () => {
  let service: LecturersService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositoryMock.findUserStatus.mockResolvedValue(UserStatus.ACTIVE);
    repositoryMock.create.mockResolvedValue(lecturerProfile);
    repositoryMock.findById.mockResolvedValue(lecturerProfile);
    repositoryMock.list.mockResolvedValue([lecturerProfile]);
    repositoryMock.update.mockResolvedValue(lecturerProfile);
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:structure:manage"],
    });
    service = new LecturersService(
      repositoryMock as unknown as LecturersRepository,
      rbacMock as unknown as RbacService,
    );
  });

  it("creates a lecturer profile for an existing account in an active department", async () => {
    // Arrange: the registrar provides a whitespace-padded staff number.

    // Act: create the linked profile.
    const result = await service.createLecturer(
      { userId: LECTURER_USER_ID, departmentId: DEPARTMENT_ID, staffNumber: " lec-001 " },
      ACTOR_ID,
    );

    // Assert: staff-number normalization and audit actor are passed to persistence.
    expect(result).toBe(lecturerProfile);
    expect(repositoryMock.create).toHaveBeenCalledWith(
      { userId: LECTURER_USER_ID, departmentId: DEPARTMENT_ID, staffNumber: "LEC-001" },
      ACTOR_ID,
    );
  });

  it("requires academic structure permission before profile management", async () => {
    // Arrange: the actor has no academic structure permission.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({ roles: [], permissions: [] });

    // Act / Assert: deny before any profile lookup.
    await expect(service.listLecturers({}, ACTOR_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositoryMock.list).not.toHaveBeenCalled();
  });

  it("reports a duplicate staff number as a conflict", async () => {
    // Arrange: the database rejects a duplicate unique staff number.
    repositoryMock.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    // Act / Assert: return a conflict rather than leaking Prisma details.
    await expect(
      service.createLecturer(
        { userId: LECTURER_USER_ID, departmentId: DEPARTMENT_ID, staffNumber: "LEC-001" },
        ACTOR_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
