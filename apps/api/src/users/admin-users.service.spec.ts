// Purpose: Test administrator account-management permissions and lifecycle behavior.
import { BadRequestException, ForbiddenException, Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UserStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_SERVICE } from "../auth/email/email-service.interface.js";
import type { EmailService } from "../auth/email/email-service.interface.js";
import { PasswordHashingService } from "../auth/password-hashing.service.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AdminUsersRepository, type AdminManagedUser } from "./admin-users.repository.js";
import { AdminUsersService } from "./admin-users.service.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const ADMIN_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const TARGET_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ROLE_LECTURER_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const ROLE_REGISTRAR_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const ROLE_ADMIN_ID = "a22d7a09-058a-4cc7-844e-345963631882";

const managedUser: AdminManagedUser = {
  id: TARGET_ID,
  name: "Avery Student",
  email: "avery@example.test",
  status: UserStatus.ACTIVE,
  emailVerified: false,
  mustChangePassword: true,
  temporaryPasswordExpiresAt: new Date("2026-11-27T12:00:00.000Z"),
  createdAt: NOW,
  roles: [{ role: { id: ROLE_LECTURER_ID, name: "lecturer" } }],
};

const repositoryMock = {
  createUser: vi.fn<AdminUsersRepository["createUser"]>(),
  findExistingRoleIds: vi.fn<AdminUsersRepository["findExistingRoleIds"]>(),
  findManagedUser: vi.fn<AdminUsersRepository["findManagedUser"]>(),
  findRoleIdsGrantingPermission: vi.fn<AdminUsersRepository["findRoleIdsGrantingPermission"]>(),
  findUserRoleIds: vi.fn<AdminUsersRepository["findUserRoleIds"]>(),
  findUserStatus: vi.fn<AdminUsersRepository["findUserStatus"]>(),
  listUsers: vi.fn<AdminUsersRepository["listUsers"]>(),
  recordCredentialsEmailFailure: vi.fn<AdminUsersRepository["recordCredentialsEmailFailure"]>(),
  recordCredentialsEmailSent: vi.fn<AdminUsersRepository["recordCredentialsEmailSent"]>(),
  replaceTemporaryCredentials: vi.fn<AdminUsersRepository["replaceTemporaryCredentials"]>(),
  replaceUserRoles: vi.fn<AdminUsersRepository["replaceUserRoles"]>(),
  deactivateUser: vi.fn<AdminUsersRepository["deactivateUser"]>(),
  reactivateUser: vi.fn<AdminUsersRepository["reactivateUser"]>(),
};

const passwordHashingMock = {
  hashPassword: vi.fn<PasswordHashingService["hashPassword"]>(),
};

const rbacServiceMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
  invalidateAuthorizationSnapshot: vi.fn<RbacService["invalidateAuthorizationSnapshot"]>(),
};

const emailServiceMock = {
  send: vi.fn<EmailService["send"]>(),
};

describe("AdminUsersService", () => {
  let moduleRef: TestingModule;
  let service: AdminUsersService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    repositoryMock.createUser.mockResolvedValue(managedUser);
    repositoryMock.findExistingRoleIds.mockImplementation(async (roleIds) => roleIds);
    repositoryMock.findManagedUser.mockResolvedValue({
      ...managedUser,
      emailVerified: true,
    });
    repositoryMock.findRoleIdsGrantingPermission.mockResolvedValue([]);
    repositoryMock.findUserRoleIds.mockResolvedValue([ROLE_LECTURER_ID]);
    repositoryMock.findUserStatus.mockResolvedValue(UserStatus.ACTIVE);
    repositoryMock.listUsers.mockResolvedValue({
      users: [managedUser],
      total: 1,
    });
    repositoryMock.recordCredentialsEmailFailure.mockResolvedValue();
    repositoryMock.recordCredentialsEmailSent.mockResolvedValue();
    repositoryMock.replaceTemporaryCredentials.mockResolvedValue(managedUser);
    repositoryMock.replaceUserRoles.mockResolvedValue({
      user: managedUser,
      changed: true,
    });
    repositoryMock.deactivateUser.mockResolvedValue(managedUser);
    repositoryMock.reactivateUser.mockResolvedValue(managedUser);
    passwordHashingMock.hashPassword.mockImplementation(
      async (password) => `argon2-hash:${password}`,
    );
    rbacServiceMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["admin"],
      permissions: ["admin:user:manage"],
    });
    rbacServiceMock.invalidateAuthorizationSnapshot.mockResolvedValue();
    emailServiceMock.send.mockResolvedValue();

    moduleRef = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: AdminUsersRepository, useValue: repositoryMock },
        { provide: PasswordHashingService, useValue: passwordHashingMock },
        { provide: RbacService, useValue: rbacServiceMock },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            APP_URL: "https://sis.example.test",
            TEMP_PASSWORD_TTL_DAYS: 7,
          }),
        },
        { provide: EMAIL_SERVICE, useValue: emailServiceMock },
      ],
    }).compile();
    service = moduleRef.get(AdminUsersService);
  });

  afterEach(async () => {
    await moduleRef.close();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates an account with hashed temporary credentials sent only by email", async () => {
    // Arrange: prepare one valid staff role and a successful email transport.
    const dto = {
      email: "  Avery@Example.Test ",
      name: " Avery Student ",
      roleIds: [ROLE_LECTURER_ID],
    };

    // Act: create the account through the permission-gated service.
    const result = await service.createUser(dto, ADMIN_ID);

    // Assert: persist only the hash and send the generated password to the login URL.
    const hashedPassword = passwordHashingMock.hashPassword.mock.calls[0]?.[0];
    const message = emailServiceMock.send.mock.calls[0]?.[0];
    if (hashedPassword === undefined || message === undefined) {
      throw new Error("Expected a hashed password and credential email.");
    }

    expect(hashedPassword.length).toBeGreaterThanOrEqual(12);
    expect(message.to).toBe("avery@example.test");
    expect(message.html).toContain("https://sis.example.test/login");
    expect(message.html).toContain(hashedPassword);
    expect(result.credentialsEmailSent).toBe(true);
    expect(result.user.emailVerified).toBe(true);
    expect(result.user.mustChangePassword).toBe(true);
    expect(JSON.stringify(result)).not.toContain(hashedPassword);
    expect(repositoryMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "avery@example.test",
        name: "Avery Student",
        passwordHash: `argon2-hash:${hashedPassword}`,
        createdById: ADMIN_ID,
        temporaryPasswordExpiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1_000),
      }),
    );
    expect(repositoryMock.recordCredentialsEmailSent).toHaveBeenCalledWith(
      TARGET_ID,
      ADMIN_ID,
      "created",
    );
  });

  it("generates distinct high-entropy temporary passwords for created accounts", async () => {
    // Arrange: prepare separate accounts that use the same validated staff role.
    const firstDto = {
      email: "first@example.test",
      name: "First Staff",
      roleIds: [ROLE_LECTURER_ID],
    };
    const secondDto = {
      email: "second@example.test",
      name: "Second Staff",
      roleIds: [ROLE_LECTURER_ID],
    };

    // Act: create both accounts through the same service instance.
    await service.createUser(firstDto, ADMIN_ID);
    await service.createUser(secondDto, ADMIN_ID);

    // Assert: each credential is a long URL-safe random value, not a shared predictable default.
    const firstPassword = passwordHashingMock.hashPassword.mock.calls[0]?.[0];
    const secondPassword = passwordHashingMock.hashPassword.mock.calls[1]?.[0];
    if (firstPassword === undefined || secondPassword === undefined) {
      throw new Error("Expected a separate temporary password per account.");
    }

    expect(firstPassword).toMatch(/^[A-Za-z0-9_-]{12,}$/);
    expect(secondPassword).toMatch(/^[A-Za-z0-9_-]{12,}$/);
    expect(firstPassword).not.toBe(secondPassword);
  });

  it("keeps a created account and records a failed credential email for resend", async () => {
    // Arrange: make the provider reject delivery after account creation.
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    emailServiceMock.send.mockRejectedValue(new Error("provider unavailable"));

    // Act: create an account despite the delivery failure.
    const result = await service.createUser(
      {
        email: "avery@example.test",
        name: "Avery Student",
        roleIds: [ROLE_LECTURER_ID],
      },
      ADMIN_ID,
    );

    // Assert: the account persists, the failure is audited, and no password is returned.
    expect(repositoryMock.createUser).toHaveBeenCalledTimes(1);
    expect(result.credentialsEmailSent).toBe(false);
    expect(result.user.emailVerified).toBe(false);
    expect(repositoryMock.recordCredentialsEmailFailure).toHaveBeenCalledWith(
      TARGET_ID,
      ADMIN_ID,
      "created",
    );
    expect(repositoryMock.recordCredentialsEmailSent).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("temporaryPassword");
  });

  it("rotates temporary credentials through the repository before resending them", async () => {
    // Arrange: request credentials for an active account with a successful email provider.
    repositoryMock.findUserStatus.mockResolvedValue(UserStatus.ACTIVE);

    // Act: resend the account's temporary credentials.
    const result = await service.resendCredentials(TARGET_ID, ADMIN_ID);

    // Assert: the replacement hash and expiry are persisted before the password is emailed.
    const temporaryPassword = passwordHashingMock.hashPassword.mock.calls[0]?.[0];
    const message = emailServiceMock.send.mock.calls[0]?.[0];
    if (temporaryPassword === undefined || message === undefined) {
      throw new Error("Expected a replacement password and email.");
    }

    expect(repositoryMock.replaceTemporaryCredentials).toHaveBeenCalledWith(
      TARGET_ID,
      ADMIN_ID,
      `argon2-hash:${temporaryPassword}`,
      new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1_000),
      NOW,
    );
    expect(message.html).toContain(temporaryPassword);
    expect(result).toEqual({ credentialsEmailSent: true });
    expect(JSON.stringify(result)).not.toContain(temporaryPassword);
  });

  it("requires the permission rather than a role name", async () => {
    // Arrange: provide an active account whose permission snapshot lacks the key.
    rbacServiceMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["admin"],
      permissions: [],
    });

    // Act / Assert: deny account listing despite the role label.
    await expect(service.listUsers({}, ADMIN_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repositoryMock.listUsers).not.toHaveBeenCalled();
  });

  it("blocks admin-capability assignment until second approval is available", async () => {
    // Arrange: identify a requested role by its granted permission, not its name.
    repositoryMock.findUserRoleIds.mockResolvedValue([]);
    repositoryMock.findRoleIdsGrantingPermission.mockResolvedValue([ROLE_ADMIN_ID]);

    // Act / Assert: reject the admin-capability change without writing assignments.
    await expect(service.updateRoles(TARGET_ID, [ROLE_ADMIN_ID], ADMIN_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repositoryMock.replaceUserRoles).not.toHaveBeenCalled();
  });

  it("blocks an administrator from removing their own admin-capability role", async () => {
    // Arrange: the current role grants the management permission.
    repositoryMock.findUserRoleIds.mockResolvedValue([ROLE_ADMIN_ID]);
    repositoryMock.findRoleIdsGrantingPermission.mockResolvedValue([ROLE_ADMIN_ID]);

    // Act / Assert: forbid self-removal before the repository changes assignments.
    await expect(service.updateRoles(ADMIN_ID, [], ADMIN_ID)).rejects.toThrow(
      "cannot remove their own administrator access",
    );
    expect(repositoryMock.replaceUserRoles).not.toHaveBeenCalled();
  });

  it("audits ordinary role changes and invalidates the target permission cache", async () => {
    // Arrange: replace one non-admin role with another non-admin role.
    repositoryMock.findUserRoleIds.mockResolvedValue([ROLE_LECTURER_ID]);
    repositoryMock.findRoleIdsGrantingPermission.mockResolvedValue([]);

    // Act: update the role assignment.
    await service.updateRoles(TARGET_ID, [ROLE_REGISTRAR_ID], ADMIN_ID);

    // Assert: repository audit and cache invalidation follow the successful change.
    expect(repositoryMock.replaceUserRoles).toHaveBeenCalledWith(
      TARGET_ID,
      [ROLE_REGISTRAR_ID],
      ADMIN_ID,
    );
    expect(rbacServiceMock.invalidateAuthorizationSnapshot).toHaveBeenCalledWith(TARGET_ID);
  });

  it("rejects self-deactivation and missing reasons", async () => {
    // Arrange: keep both target accounts in the active state.
    const activeStatus = UserStatus.ACTIVE;
    repositoryMock.findUserStatus.mockResolvedValue(activeStatus);

    // Act / Assert: deny self-deactivation and a blank reason for another account.
    await expect(service.deactivateUser(ADMIN_ID, ADMIN_ID, "staff change")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.deactivateUser(TARGET_ID, ADMIN_ID, "   ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repositoryMock.deactivateUser).not.toHaveBeenCalled();
  });

  it("requires a reason to reactivate an account", async () => {
    // Arrange: make the target account deactivated.
    repositoryMock.findUserStatus.mockImplementation(async (userId) =>
      userId === ADMIN_ID ? UserStatus.ACTIVE : UserStatus.DEACTIVATED,
    );

    // Act / Assert: reject an empty reason without changing the account.
    await expect(service.reactivateUser(TARGET_ID, ADMIN_ID, "  ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repositoryMock.reactivateUser).not.toHaveBeenCalled();
  });

  it("applies role, status, search, and bounded pagination filters", async () => {
    // Arrange: request the second page with normalized text filters.
    const filters = {
      search: "  Avery ",
      role: " lecturer ",
      status: UserStatus.ACTIVE,
      page: 2,
      pageSize: 10,
    };

    // Act: list users with the requested filters.
    const page = await service.listUsers(filters, ADMIN_ID);

    // Assert: filtering and pagination are passed to persistence without secret fields.
    expect(repositoryMock.listUsers).toHaveBeenCalledWith({
      search: "Avery",
      role: "lecturer",
      status: UserStatus.ACTIVE,
      skip: 10,
      take: 10,
    });
    expect(page).toEqual({
      users: [managedUser],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });
});
