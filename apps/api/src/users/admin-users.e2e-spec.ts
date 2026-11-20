// Purpose: Exercise admin user-management permissions and lifecycle routes over HTTP.
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpExceptionFilter } from "../common/http-exception.filter.js";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import type { AuthorizationSnapshot } from "../common/rbac/rbac.types.js";
import { EMAIL_SERVICE } from "../auth/email/email-service.interface.js";
import type { EmailService } from "../auth/email/email-service.interface.js";
import { PasswordHashingService } from "../auth/password-hashing.service.js";
import { AdminUsersController } from "./admin-users.controller.js";
import {
  AdminUsersRepository,
  type AdminManagedUser,
  type NewAdminManagedUser,
} from "./admin-users.repository.js";
import { AdminUsersService } from "./admin-users.service.js";

const ACCESS_SECRET = "test-only-access-signing-secret-with-32-bytes";
const ADMIN_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const NON_ADMIN_ID = "71e5a804-280c-4229-8808-32b77006f826";
const CREATED_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ROLE_ADMIN_ID = "a22d7a09-058a-4cc7-844e-345963631882";
const ROLE_STUDENT_ID = "2d1c0d45-f3a1-4ad0-9c7d-2793a6732401";
const ROLE_LECTURER_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const ROLE_REGISTRAR_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";

const roles = new Map([
  [ROLE_ADMIN_ID, "admin"],
  [ROLE_STUDENT_ID, "student"],
  [ROLE_LECTURER_ID, "lecturer"],
  [ROLE_REGISTRAR_ID, "registrar"],
]);

const managedUsers = new Map<string, AdminManagedUser>();
const activeSessions = new Map<string, { userId: string; revoked: boolean }>();
const credentialEmails: Parameters<EmailService["send"]>[0][] = [];

const makeUser = (
  id: string,
  email: string,
  name: string,
  roleIds: string[],
): AdminManagedUser => ({
  id,
  email,
  name,
  status: UserStatus.ACTIVE,
  emailVerified: true,
  mustChangePassword: false,
  temporaryPasswordExpiresAt: null,
  createdAt: new Date("2026-11-20T12:00:00.000Z"),
  roles: roleIds.map((roleId) => {
    const roleName = roles.get(roleId);
    if (roleName === undefined) {
      throw new Error(`Unknown test role: ${roleId}`);
    }

    return { role: { id: roleId, name: roleName } };
  }),
});

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
  isActiveSession: vi.fn<RbacService["isActiveSession"]>(),
};

const emailServiceMock = {
  send: vi.fn<EmailService["send"]>(),
};

describe("Admin user-management E2E", () => {
  let app: INestApplication;
  let adminToken: string;
  let nonAdminToken: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    managedUsers.clear();
    activeSessions.clear();
    credentialEmails.length = 0;
    managedUsers.set(
      ADMIN_ID,
      makeUser(ADMIN_ID, "admin@example.test", "System Admin", [ROLE_ADMIN_ID]),
    );
    managedUsers.set(
      NON_ADMIN_ID,
      makeUser(NON_ADMIN_ID, "student@example.test", "Test Student", [ROLE_STUDENT_ID]),
    );
    activeSessions.set("admin-session", { userId: ADMIN_ID, revoked: false });
    activeSessions.set("student-session", {
      userId: NON_ADMIN_ID,
      revoked: false,
    });

    repositoryMock.createUser.mockImplementation(async (input: NewAdminManagedUser) => {
      const user = makeUser(CREATED_USER_ID, input.email, input.name, input.roleIds);
      const created = {
        ...user,
        emailVerified: false,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: input.temporaryPasswordExpiresAt,
      };
      managedUsers.set(CREATED_USER_ID, created);
      return created;
    });
    repositoryMock.findExistingRoleIds.mockImplementation(async (ids) =>
      ids.filter((id) => roles.has(id)),
    );
    repositoryMock.findManagedUser.mockImplementation(async (id) => managedUsers.get(id) ?? null);
    repositoryMock.findRoleIdsGrantingPermission.mockImplementation(async (ids, permission) =>
      permission === "admin:user:manage" && ids.includes(ROLE_ADMIN_ID) ? [ROLE_ADMIN_ID] : [],
    );
    repositoryMock.findUserRoleIds.mockImplementation(async (id) => {
      const user = managedUsers.get(id);
      return user?.roles.map(({ role }) => role.id) ?? null;
    });
    repositoryMock.findUserStatus.mockImplementation(
      async (id) => managedUsers.get(id)?.status ?? null,
    );
    repositoryMock.listUsers.mockImplementation(async (query) => {
      const filtered = [...managedUsers.values()].filter((user) => {
        const searchMatches =
          query.search === undefined ||
          user.email.toLowerCase().includes(query.search.toLowerCase()) ||
          (user.name ?? "").toLowerCase().includes(query.search.toLowerCase());
        const roleMatches =
          query.role === undefined || user.roles.some(({ role }) => role.name === query.role);
        const statusMatches = query.status === undefined || user.status === query.status;
        return searchMatches && roleMatches && statusMatches;
      });
      return {
        users: filtered.slice(query.skip, query.skip + query.take),
        total: filtered.length,
      };
    });
    repositoryMock.recordCredentialsEmailFailure.mockResolvedValue();
    repositoryMock.recordCredentialsEmailSent.mockImplementation(async (id) => {
      const user = managedUsers.get(id);
      if (user !== undefined) {
        managedUsers.set(id, { ...user, emailVerified: true });
      }
    });
    repositoryMock.replaceTemporaryCredentials.mockImplementation(
      async (id, _actorId, _hash, expiresAt) => {
        const user = managedUsers.get(id);
        if (user === undefined || user.status !== UserStatus.ACTIVE) {
          return null;
        }
        const updated = {
          ...user,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
        };
        managedUsers.set(id, updated);
        return updated;
      },
    );
    repositoryMock.replaceUserRoles.mockImplementation(async (id, roleIds) => {
      const user = managedUsers.get(id);
      if (user === undefined) {
        return { user: null, changed: false };
      }
      const updated = {
        ...user,
        roles: roleIds.map((roleId) => {
          const roleName = roles.get(roleId);
          if (roleName === undefined) {
            throw new Error(`Unknown test role: ${roleId}`);
          }
          return { role: { id: roleId, name: roleName } };
        }),
      };
      const changed = JSON.stringify(user.roles) !== JSON.stringify(updated.roles);
      managedUsers.set(id, updated);
      return { user: updated, changed };
    });
    repositoryMock.deactivateUser.mockImplementation(async (id, _actorId, _reason, _now) => {
      const user = managedUsers.get(id);
      if (user === undefined) {
        return null;
      }
      const updated = { ...user, status: UserStatus.DEACTIVATED };
      managedUsers.set(id, updated);
      for (const [sessionId, session] of activeSessions) {
        if (session.userId === id) {
          activeSessions.set(sessionId, { ...session, revoked: true });
        }
      }
      return updated;
    });
    repositoryMock.reactivateUser.mockImplementation(async (id) => {
      const user = managedUsers.get(id);
      if (user === undefined) {
        return null;
      }
      const updated = { ...user, status: UserStatus.ACTIVE };
      managedUsers.set(id, updated);
      return updated;
    });
    passwordHashingMock.hashPassword.mockImplementation(
      async (password) => `test-hash:${password}`,
    );
    rbacServiceMock.getAuthorizationSnapshot.mockImplementation(
      async (userId): Promise<AuthorizationSnapshot> => {
        const user = managedUsers.get(userId);
        const userRoles = user?.roles.map(({ role }) => role.name) ?? [];
        return {
          roles: userRoles,
          permissions: userRoles.includes("admin") ? ["admin:user:manage"] : [],
        };
      },
    );
    rbacServiceMock.invalidateAuthorizationSnapshot.mockResolvedValue();
    rbacServiceMock.isActiveSession.mockImplementation(async (userId, sessionId) => {
      const session = activeSessions.get(sessionId);
      return session !== undefined && session.userId === userId && !session.revoked;
    });
    emailServiceMock.send.mockImplementation(async (message) => {
      credentialEmails.push(message);
    });

    const jwtService = new JwtService({
      secret: ACCESS_SECRET,
      signOptions: { algorithm: "HS256", expiresIn: 900 },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [AdminUsersController],
      providers: [
        AdminUsersService,
        JwtAuthGuard,
        PermissionsGuard,
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
        { provide: JwtService, useValue: jwtService },
        { provide: EMAIL_SERVICE, useValue: emailServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    adminToken = await jwtService.signAsync({
      sub: ADMIN_ID,
      sid: "admin-session",
      email: "admin@example.test",
    });
    nonAdminToken = await jwtService.signAsync({
      sub: NON_ADMIN_ID,
      sid: "student-session",
      email: "student@example.test",
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("denies non-admins and allows admins to create, list, change roles, and deactivate users", async () => {
    // Arrange: prepare a valid account body and a reason for deactivation.
    const createBody = {
      email: "lecturer@example.test",
      name: "Taylor Lecturer",
      roleIds: [ROLE_LECTURER_ID],
    };
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Act: reject the student, then exercise the administrator's complete lifecycle.
    const deniedResponse = await request(app.getHttpServer())
      .get("/admin/users")
      .set("Authorization", `Bearer ${nonAdminToken}`)
      .expect(403);
    const createdResponse = await request(app.getHttpServer())
      .post("/admin/users")
      .set(adminHeaders)
      .send(createBody)
      .expect(201);
    const listResponse = await request(app.getHttpServer())
      .get("/admin/users")
      .set(adminHeaders)
      .expect(200);
    const rolesResponse = await request(app.getHttpServer())
      .patch(`/admin/users/${CREATED_USER_ID}/roles`)
      .set(adminHeaders)
      .send({ roleIds: [ROLE_REGISTRAR_ID] })
      .expect(200);
    const deactivateResponse = await request(app.getHttpServer())
      .post(`/admin/users/${CREATED_USER_ID}/deactivate`)
      .set(adminHeaders)
      .send({ reason: "Position ended." })
      .expect(200);

    // Assert: permission checks, credential privacy, and account lifecycle changes are observable.
    expect(deniedResponse.body.code).toBe("FORBIDDEN");
    expect(createdResponse.body).toMatchObject({
      user: { id: CREATED_USER_ID, email: createBody.email },
      credentialsEmailSent: true,
    });
    expect(createdResponse.body).not.toHaveProperty("temporaryPassword");
    expect(credentialEmails).toHaveLength(1);
    expect(credentialEmails[0]?.html).toContain("Temporary password: <code>");
    expect(
      listResponse.body.users.some((user: AdminManagedUser) => user.id === CREATED_USER_ID),
    ).toBe(true);
    expect(rolesResponse.body.roles).toEqual([
      { role: { id: ROLE_REGISTRAR_ID, name: "registrar" } },
    ]);
    expect(deactivateResponse.body.status).toBe(UserStatus.DEACTIVATED);
  });
});
