// Purpose: Verify atomic administrator-user writes, session revocation, and audit records.
import { Test, TestingModule } from "@nestjs/testing";
import { UserStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { AdminUsersRepository, type AdminManagedUser } from "./admin-users.repository.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const TARGET_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ADMIN_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";

const managedUser: AdminManagedUser = {
  id: TARGET_ID,
  name: "Avery Student",
  email: "avery@example.test",
  status: UserStatus.ACTIVE,
  emailVerified: true,
  mustChangePassword: true,
  temporaryPasswordExpiresAt: new Date("2026-11-27T12:00:00.000Z"),
  createdAt: NOW,
  roles: [],
};

const transactionMock = {
  auditLog: {
    create: vi.fn(),
  },
  session: {
    updateMany: vi.fn(),
  },
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(
    async (operation: (transaction: typeof transactionMock) => Promise<unknown>) =>
      operation(transactionMock),
  ),
};

describe("AdminUsersRepository", () => {
  let moduleRef: TestingModule;
  let repository: AdminUsersRepository;

  beforeEach(async () => {
    vi.resetAllMocks();
    transactionMock.auditLog.create.mockResolvedValue({});
    transactionMock.session.updateMany.mockResolvedValue({ count: 2 });
    transactionMock.user.create.mockResolvedValue({ id: TARGET_ID });
    transactionMock.user.findUnique.mockResolvedValue(managedUser);
    transactionMock.user.findUniqueOrThrow.mockResolvedValue(managedUser);
    transactionMock.user.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.userRole.createMany.mockResolvedValue({ count: 1 });
    transactionMock.userRole.create.mockResolvedValue({});
    transactionMock.userRole.deleteMany.mockResolvedValue({ count: 1 });
    transactionMock.role.findUnique.mockResolvedValue({ id: "student-role-id" });

    moduleRef = await Test.createTestingModule({
      providers: [AdminUsersRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    repository = moduleRef.get(AdminUsersRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("creates the account, role assignments, and audit record in one transaction", async () => {
    // Arrange: prepare a hashed credential and a non-admin role.
    const expiresAt = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1_000);

    // Act: create the administrator-provisioned account.
    const result = await repository.createUser({
      email: "avery@example.test",
      name: "Avery Student",
      passwordHash: "argon2-hash",
      roleIds: ["role-lecturer"],
      createdById: ADMIN_ID,
      temporaryPasswordExpiresAt: expiresAt,
    });

    // Assert: lifecycle fields and roles are persisted with a credential-free audit record.
    expect(result).toEqual(managedUser);
    expect(transactionMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: "avery@example.test",
          name: "Avery Student",
          passwordHash: "argon2-hash",
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
          createdById: ADMIN_ID,
        },
      }),
    );
    expect(transactionMock.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: TARGET_ID, roleId: "role-lecturer" }],
    });
    const auditCall = transactionMock.auditLog.create.mock.calls[0]?.[0];
    if (auditCall === undefined) {
      throw new Error("Expected an account-creation audit record.");
    }
    expect(auditCall.data).toEqual({
      actorId: ADMIN_ID,
      action: "admin.user.created",
      resourceType: "user",
      resourceId: TARGET_ID,
      metadata: { roleIds: ["role-lecturer"] },
    });
    expect(auditCall.data).not.toHaveProperty("passwordHash");
  });

  it("creates the student account and student role using the admission transaction", async () => {
    // Arrange: prepare the role lookup and user result returned by Prisma.
    const expiresAt = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1_000);
    transactionMock.user.create.mockResolvedValue({
      id: TARGET_ID,
      email: "avery@example.test",
      name: "Avery Student",
      temporaryPasswordExpiresAt: expiresAt,
    });

    // Act: add the account, student role, and audit record to the supplied transaction.
    const result = await repository.createStudentForAdmission(
      transactionMock as unknown as Prisma.TransactionClient,
      {
        email: "avery@example.test",
        name: "Avery Student",
        passwordHash: "argon2-hash",
        createdById: ADMIN_ID,
        temporaryPasswordExpiresAt: expiresAt,
      },
    );

    // Assert: all writes use the caller's transaction and no credential is included in audit data.
    expect(result.id).toBe(TARGET_ID);
    expect(transactionMock.role.findUnique).toHaveBeenCalledWith({
      where: { name: "student" },
      select: { id: true },
    });
    expect(transactionMock.userRole.create).toHaveBeenCalledWith({
      data: { userId: TARGET_ID, roleId: "student-role-id" },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        action: "admissions.student.account_created",
        resourceType: "user",
        resourceId: TARGET_ID,
        metadata: { roleId: "student-role-id" },
      },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rotates credentials, revokes active sessions, and audits the resend atomically", async () => {
    // Arrange: set the replacement password hash and expiry.
    const expiresAt = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1_000);

    // Act: replace the temporary credentials for an active account.
    const result = await repository.replaceTemporaryCredentials(
      TARGET_ID,
      ADMIN_ID,
      "argon2-hash",
      expiresAt,
      NOW,
    );

    // Assert: the password update, session revocation, and audit use one transaction.
    expect(result).toEqual(managedUser);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET_ID, status: UserStatus.ACTIVE },
      data: {
        passwordHash: "argon2-hash",
        mustChangePassword: true,
        temporaryPasswordExpiresAt: expiresAt,
      },
    });
    expect(transactionMock.session.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, revokedAt: null },
      data: { revokedAt: NOW },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        action: "admin.user.credentials_resent",
        resourceType: "user",
        resourceId: TARGET_ID,
      },
    });
  });

  it("deactivates an account, revokes sessions, and keeps the reason in the audit record", async () => {
    // Arrange: prepare the update and session-revocation transaction.
    const reason = "Employment ended";

    // Act: deactivate the target account.
    await repository.deactivateUser(TARGET_ID, ADMIN_ID, reason, NOW);

    // Assert: lifecycle state, session revocation, and reason are persisted atomically.
    expect(transactionMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET_ID, status: { not: UserStatus.DEACTIVATED } },
      data: {
        status: UserStatus.DEACTIVATED,
        deactivatedAt: NOW,
        deactivatedById: ADMIN_ID,
      },
    });
    expect(transactionMock.session.updateMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, revokedAt: null },
      data: { revokedAt: NOW },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        action: "admin.user.deactivated",
        resourceType: "user",
        resourceId: TARGET_ID,
        reason,
      },
    });
  });

  it("reactivates only through the deactivated state and audits the reason", async () => {
    // Arrange: supply the required explanation for reactivation.
    const reason = "Access restored after review";

    // Act: reactivate the target account.
    await repository.reactivateUser(TARGET_ID, ADMIN_ID, reason);

    // Assert: current-state fields are cleared while the reason remains in history.
    expect(transactionMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET_ID, status: UserStatus.DEACTIVATED },
      data: {
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
        deactivatedById: null,
      },
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        action: "admin.user.reactivated",
        resourceType: "user",
        resourceId: TARGET_ID,
        reason,
      },
    });
  });

  it("audits the exact role delta in the same transaction as the assignment update", async () => {
    // Arrange: replace an existing role with a new role.
    transactionMock.user.findUnique
      .mockResolvedValueOnce({ roles: [{ roleId: "role-old" }] })
      .mockResolvedValueOnce(managedUser);

    // Act: replace the target's role set.
    const result = await repository.replaceUserRoles(TARGET_ID, ["role-new"], ADMIN_ID);

    // Assert: the removed and added IDs are captured by the immutable audit event.
    expect(result.changed).toBe(true);
    expect(transactionMock.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID, roleId: { in: ["role-old"] } },
    });
    expect(transactionMock.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: TARGET_ID, roleId: "role-new" }],
    });
    expect(transactionMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: ADMIN_ID,
        action: "admin.user.roles_updated",
        resourceType: "user",
        resourceId: TARGET_ID,
        metadata: {
          addedRoleIds: ["role-new"],
          removedRoleIds: ["role-old"],
        },
      },
    });
  });
});
