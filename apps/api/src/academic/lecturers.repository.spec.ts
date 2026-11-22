// Purpose: Verify transactional lecturer-profile creation and audit persistence.
import { UserStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { LecturersRepository } from "./lecturers.repository.js";
import type { LecturerProfile } from "./lecturers.repository.js";

const LECTURER_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const LECTURER_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ACTOR_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const DEPARTMENT_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const NOW = new Date("2026-11-22T12:00:00.000Z");

const lecturer: LecturerProfile = {
  id: LECTURER_ID,
  userId: LECTURER_USER_ID,
  departmentId: DEPARTMENT_ID,
  staffNumber: "LEC-001",
  createdAt: NOW,
  updatedAt: NOW,
  user: {
    id: LECTURER_USER_ID,
    name: "Taylor Lecturer",
    email: "taylor@example.test",
    status: UserStatus.ACTIVE,
  },
  department: { id: DEPARTMENT_ID, code: "SCI", name: "Science" },
};

const transactionMock = {
  auditLog: { create: vi.fn() },
  department: { findFirst: vi.fn() },
  lecturer: { create: vi.fn() },
  user: { findFirst: vi.fn() },
};

const prismaMock = {
  $transaction: vi.fn(async (work: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
    work(transactionMock as unknown as Prisma.TransactionClient),
  ),
};

describe("LecturersRepository", () => {
  let repository: LecturersRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.user.findFirst.mockResolvedValue({ id: LECTURER_USER_ID });
    transactionMock.department.findFirst.mockResolvedValue({ id: DEPARTMENT_ID });
    transactionMock.lecturer.create.mockResolvedValue(lecturer);
    transactionMock.auditLog.create.mockResolvedValue({});
    repository = new LecturersRepository(prismaMock as unknown as PrismaService);
  });

  it("creates a department-linked profile and audit event in one transaction", async () => {
    // Arrange: the account is active and both related profiles and department are valid.

    // Act: create the lecturer profile.
    const result = await repository.create(
      { userId: LECTURER_USER_ID, departmentId: DEPARTMENT_ID, staffNumber: "LEC-001" },
      ACTOR_ID,
    );

    // Assert: the profile references the department and the audit is part of the transaction.
    expect(result).toBe(lecturer);
    expect(transactionMock.lecturer.create).toHaveBeenCalledWith({
      data: {
        userId: LECTURER_USER_ID,
        departmentId: DEPARTMENT_ID,
        staffNumber: "LEC-001",
      },
      include: expect.any(Object),
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ACTOR_ID,
        action: "academic.lecturer.created",
        resourceType: "lecturer",
        resourceId: LECTURER_ID,
      }),
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
