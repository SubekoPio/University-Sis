// Purpose: Test administrator user routes, validation, authorization metadata, and OpenAPI output.
import { ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpExceptionFilter } from "../common/http-exception.filter.js";
import { PERMISSIONS_METADATA_KEY } from "../common/rbac/rbac.decorators.js";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import type { AuthenticatedRequest } from "../common/rbac/rbac.types.js";
import { AdminUsersController } from "./admin-users.controller.js";
import {
  AdminUsersService,
  type AdminUserCreationResult,
  type AdminUserPage,
} from "./admin-users.service.js";
import type { AdminManagedUser } from "./admin-users.repository.js";

const ADMIN_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const TARGET_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const ROLE_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";

const managedUser: AdminManagedUser = {
  id: TARGET_ID,
  name: "Avery Student",
  email: "avery@example.test",
  status: UserStatus.ACTIVE,
  emailVerified: true,
  mustChangePassword: false,
  temporaryPasswordExpiresAt: null,
  createdAt: new Date("2026-11-20T12:00:00.000Z"),
  roles: [{ role: { id: ROLE_ID, name: "lecturer" } }],
};

const creationResult: AdminUserCreationResult = {
  user: managedUser,
  credentialsEmailSent: true,
};

const userPage: AdminUserPage = {
  users: [managedUser],
  total: 1,
  page: 1,
  pageSize: 25,
};

const adminUsersServiceMock = {
  createUser: vi.fn<AdminUsersService["createUser"]>(),
  listUsers: vi.fn<AdminUsersService["listUsers"]>(),
  resendCredentials: vi.fn<AdminUsersService["resendCredentials"]>(),
  updateRoles: vi.fn<AdminUsersService["updateRoles"]>(),
  deactivateUser: vi.fn<AdminUsersService["deactivateUser"]>(),
  reactivateUser: vi.fn<AdminUsersService["reactivateUser"]>(),
};

const jwtAuthGuardMock = {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = {
      id: ADMIN_ID,
      email: "admin@example.test",
      sessionId: "admin-session",
    };
    return true;
  },
};

const permissionsGuardMock = {
  canActivate(): boolean {
    return true;
  },
};

describe("AdminUsersController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.resetAllMocks();
    adminUsersServiceMock.createUser.mockResolvedValue(creationResult);
    adminUsersServiceMock.listUsers.mockResolvedValue(userPage);
    adminUsersServiceMock.resendCredentials.mockResolvedValue({
      credentialsEmailSent: true,
    });
    adminUsersServiceMock.updateRoles.mockResolvedValue(managedUser);
    adminUsersServiceMock.deactivateUser.mockResolvedValue(managedUser);
    adminUsersServiceMock.reactivateUser.mockResolvedValue(managedUser);

    const moduleBuilder = Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: adminUsersServiceMock }],
    });
    const moduleRef = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuardMock)
      .overrideGuard(PermissionsGuard)
      .useValue(permissionsGuardMock)
      .compile();

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
  });

  afterEach(async () => {
    await app.close();
  });

  it("delegates each route to the matching service operation with the authenticated actor", async () => {
    // Arrange: prepare valid bodies and filters for all account-management routes.
    const createBody = {
      email: "new-staff@example.test",
      name: "New Staff",
      roleIds: [ROLE_ID],
    };
    const roleBody = { roleIds: [ROLE_ID] };
    const reasonBody = { reason: "Staff status changed." };

    // Act: call each route with the DTO shape expected by the service.
    await request(app.getHttpServer()).post("/admin/users").send(createBody).expect(201);
    await request(app.getHttpServer())
      .get("/admin/users")
      .query({
        search: "Avery",
        role: "lecturer",
        status: UserStatus.ACTIVE,
        page: "2",
        pageSize: "10",
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET_ID}/resend-credentials`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/users/${TARGET_ID}/roles`)
      .send(roleBody)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET_ID}/deactivate`)
      .send(reasonBody)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/admin/users/${TARGET_ID}/reactivate`)
      .send(reasonBody)
      .expect(200);

    // Assert: the HTTP adapter passes validated inputs and the authenticated actor unchanged.
    expect(adminUsersServiceMock.createUser).toHaveBeenCalledWith(createBody, ADMIN_ID);
    expect(adminUsersServiceMock.listUsers).toHaveBeenCalledWith(
      {
        search: "Avery",
        role: "lecturer",
        status: UserStatus.ACTIVE,
        page: 2,
        pageSize: 10,
      },
      ADMIN_ID,
    );
    expect(adminUsersServiceMock.resendCredentials).toHaveBeenCalledWith(TARGET_ID, ADMIN_ID);
    expect(adminUsersServiceMock.updateRoles).toHaveBeenCalledWith(
      TARGET_ID,
      roleBody.roleIds,
      ADMIN_ID,
    );
    expect(adminUsersServiceMock.deactivateUser).toHaveBeenCalledWith(
      TARGET_ID,
      ADMIN_ID,
      reasonBody.reason,
    );
    expect(adminUsersServiceMock.reactivateUser).toHaveBeenCalledWith(
      TARGET_ID,
      ADMIN_ID,
      reasonBody.reason,
    );
  });

  it("rejects invalid bodies, route IDs, and pagination before service delegation", async () => {
    // Arrange: prepare malformed account, user-ID, and query input.
    const invalidCreateBody = {
      email: "invalid-email",
      name: "",
      roleIds: [],
    };

    // Act: submit invalid values to their respective routes.
    const createResponse = await request(app.getHttpServer())
      .post("/admin/users")
      .send(invalidCreateBody)
      .expect(400);
    const idResponse = await request(app.getHttpServer())
      .post("/admin/users/not-a-uuid/resend-credentials")
      .expect(400);
    const pageResponse = await request(app.getHttpServer())
      .get("/admin/users")
      .query({ page: "not-a-number" })
      .expect(400);

    // Assert: the validation pipe prevents invalid requests from reaching service methods.
    expect(createResponse.body.code).toBe("VALIDATION_ERROR");
    expect(idResponse.body.code).toBe("VALIDATION_ERROR");
    expect(pageResponse.body.code).toBe("VALIDATION_ERROR");
    expect(adminUsersServiceMock.createUser).not.toHaveBeenCalled();
    expect(adminUsersServiceMock.resendCredentials).not.toHaveBeenCalled();
    expect(adminUsersServiceMock.listUsers).not.toHaveBeenCalled();
  });

  it("limits credential resends to five requests per minute", async () => {
    // Arrange: requests share an IP and endpoint key, so they share one limit bucket.

    // Act: consume the configured allowance, then submit one extra request.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post(`/admin/users/${TARGET_ID}/resend-credentials`)
        .expect(200);
    }
    const response = await request(app.getHttpServer())
      .post(`/admin/users/${TARGET_ID}/resend-credentials`)
      .expect(429);

    // Assert: the extra request gets the standard rate-limit error and is not delegated.
    expect(response.body).toMatchObject({
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
      path: `/admin/users/${TARGET_ID}/resend-credentials`,
    });
    expect(adminUsersServiceMock.resendCredentials).toHaveBeenCalledTimes(5);
  });

  it("declares the JWT guard, permission, and OpenAPI operation metadata", async () => {
    // Arrange: create the OpenAPI document from the initialized controller metadata.
    const reflector = new Reflector();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("University SIS API")
        .setVersion("1.0")
        .addBearerAuth()
        .build(),
    );

    // Act: inspect the controller-wide requirements and generated endpoint schemas.
    const guards = reflector.get<unknown[]>(GUARDS_METADATA, AdminUsersController);
    const permission = reflector.get<string[]>(PERMISSIONS_METADATA_KEY, AdminUsersController);
    const createOperation = document.paths["/admin/users"]?.post;
    const listParameters = document.paths["/admin/users"]?.get?.parameters;

    // Assert: every controller route inherits protection and Swagger documents the request.
    expect(guards).toEqual([JwtAuthGuard, PermissionsGuard]);
    expect(permission).toEqual(["admin:user:manage"]);
    expect(createOperation?.summary).toBe("Create an administrator-managed user account");
    expect(createOperation?.security).toEqual([{ bearer: [] }]);
    expect(document.components?.schemas?.CreateAdminUserRequestDto).toBeDefined();
    expect(document.paths["/admin/users/{id}/resend-credentials"]?.post).toBeDefined();
    expect(document.paths["/admin/users/{id}/roles"]?.patch).toBeDefined();
    expect(document.paths["/admin/users/{id}/deactivate"]?.post).toBeDefined();
    expect(document.paths["/admin/users/{id}/reactivate"]?.post).toBeDefined();
    expect(listParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "query", name: "page" }),
        expect.objectContaining({ in: "query", name: "status" }),
      ]),
    );
  });
});
