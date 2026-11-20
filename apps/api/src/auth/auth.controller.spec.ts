// Purpose: Test authentication endpoint validation, delegation, and throttling.
import { ExecutionContext, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpExceptionFilter } from "../common/http-exception.filter.js";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/rbac/rbac.types.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import type { AuthResult } from "./auth.types.js";

const authResult: AuthResult = {
  accessToken: "signed-access-token",
  refreshToken: "opaque-refresh-token",
  tokenType: "Bearer",
  expiresIn: 900,
  user: {
    id: "c2d0b38c-26f3-466c-9a9e-6cc361223621",
    email: "student@example.test",
    status: UserStatus.ACTIVE,
    emailVerified: true,
  },
};

const authServiceMock = {
  login: vi.fn<AuthService["login"]>(),
  refreshToken: vi.fn<AuthService["refreshToken"]>(),
  logout: vi.fn<AuthService["logout"]>(),
  changeTemporaryPassword: vi.fn<AuthService["changeTemporaryPassword"]>(),
};

const jwtAuthGuardMock = {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = {
      id: authResult.user.id,
      email: authResult.user.email,
      sessionId: "current-session",
    };
    return true;
  },
};

const passwordRecoveryServiceMock = {
  forgotPassword: vi.fn<PasswordRecoveryService["forgotPassword"]>(),
  resetPassword: vi.fn<PasswordRecoveryService["resetPassword"]>(),
  verifyEmail: vi.fn<PasswordRecoveryService["verifyEmail"]>(),
  resendVerification: vi.fn<PasswordRecoveryService["resendVerification"]>(),
};

describe("AuthController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.resetAllMocks();
    authServiceMock.login.mockResolvedValue(authResult);
    authServiceMock.refreshToken.mockResolvedValue(authResult);
    authServiceMock.logout.mockResolvedValue();
    authServiceMock.changeTemporaryPassword.mockResolvedValue();
    passwordRecoveryServiceMock.forgotPassword.mockResolvedValue({
      message: "If an account exists for that email, reset instructions will be sent.",
    });
    passwordRecoveryServiceMock.resetPassword.mockResolvedValue();
    passwordRecoveryServiceMock.verifyEmail.mockResolvedValue();
    passwordRecoveryServiceMock.resendVerification.mockResolvedValue({
      message: "If the account exists and needs verification, instructions will be sent.",
    });

    const moduleBuilder = Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: PasswordRecoveryService,
          useValue: passwordRecoveryServiceMock,
        },
      ],
    });
    const moduleRef = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuardMock)
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

  it("rejects invalid login DTOs with the normalized error shape", async () => {
    // Arrange: prepare an invalid email, empty password, and unknown field.
    const body = {
      email: "not-an-email",
      password: "",
      unexpected: true,
    };

    // Act: submit invalid data to login.
    const response = await request(app.getHttpServer()).post("/auth/login").send(body).expect(400);

    // Assert: validation prevents service calls and returns the stable error shape.
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      timestamp: expect.any(String),
      path: "/auth/login",
    });
    expect(typeof response.body.message).toBe("string");
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it("delegates valid login data and returns the service result", async () => {
    // Arrange: provide a valid login body and a configured service response.
    const body = { email: "student@example.test", password: "valid-password" };

    // Act: submit login credentials.
    const response = await request(app.getHttpServer()).post("/auth/login").send(body).expect(200);

    // Assert: the controller forwards credentials and request metadata only.
    expect(response.body).toEqual(authResult);
    expect(authServiceMock.login).toHaveBeenCalledWith(
      body,
      expect.objectContaining({
        ip: expect.any(String),
      }),
    );
  });

  it("returns 404 for public registration and delegates refresh and logout", async () => {
    // Arrange: prepare valid bodies for the remaining session endpoints.
    const refreshBody = { refreshToken: "opaque-refresh-token" };

    // Act: verify registration is absent and exercise refresh and logout.
    const registrationResponse = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: "new@example.test", password: "valid-password" })
      .expect(404);
    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send(refreshBody)
      .expect(200);
    const logoutResponse = await request(app.getHttpServer())
      .post("/auth/logout")
      .send(refreshBody)
      .expect(200);

    // Assert: the missing route does not create an account; other routes delegate as before.
    expect(registrationResponse.body.code).toBe("NOT_FOUND");
    expect(refreshResponse.body).toEqual(authResult);
    expect(authServiceMock.refreshToken).toHaveBeenCalledWith(
      refreshBody.refreshToken,
      expect.objectContaining({ ip: expect.any(String) }),
    );
    expect(logoutResponse.body).toEqual({ success: true });
    expect(authServiceMock.logout).toHaveBeenCalledWith(refreshBody.refreshToken);
  });

  it("delegates a forced password change using the authenticated session identity", async () => {
    // Arrange: prepare a valid current and replacement password.
    const body = {
      currentPassword: "temporary-password",
      newPassword: "replacement-password",
    };

    // Act: submit the password change through the authenticated route.
    const response = await request(app.getHttpServer())
      .post("/auth/change-password")
      .send(body)
      .expect(200);

    // Assert: the controller forwards the authenticated account and session IDs.
    expect(response.body).toEqual({
      message: "Password changed successfully.",
    });
    expect(authServiceMock.changeTemporaryPassword).toHaveBeenCalledWith(
      authResult.user.id,
      "current-session",
      body.currentPassword,
      body.newPassword,
    );
  });

  it("rate-limits login and password change after five requests per minute", async () => {
    // Arrange: prepare valid bodies for each throttled endpoint.
    const endpointBodies = [
      ["/auth/login", { email: "student@example.test", password: "valid-password" }],
      [
        "/auth/change-password",
        {
          currentPassword: "temporary-password",
          newPassword: "replacement-password",
        },
      ],
    ] as const;

    // Act / Assert: each endpoint allows five requests and rejects the sixth uniformly.
    for (const [path, body] of endpointBodies) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer()).post(path).send(body).expect(200);
      }

      const response = await request(app.getHttpServer()).post(path).send(body).expect(429);

      expect(response.body).toMatchObject({
        statusCode: 429,
        code: "TOO_MANY_REQUESTS",
        timestamp: expect.any(String),
        path,
      });
      expect(typeof response.body.message).toBe("string");
    }
  });

  it("validates the change-password DTO before calling the service", async () => {
    // Arrange: include an empty password and an unknown field.
    const body = {
      currentPassword: "temporary-password",
      newPassword: "",
      unexpected: true,
    };

    // Act: submit a malformed forced-password-change request.
    const response = await request(app.getHttpServer())
      .post("/auth/change-password")
      .send(body)
      .expect(400);

    // Assert: DTO validation rejects it before service delegation.
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      path: "/auth/change-password",
    });
    expect(authServiceMock.changeTemporaryPassword).not.toHaveBeenCalled();
  });

  it("delegates recovery and verification endpoints to their service", async () => {
    // Arrange: prepare valid bodies for each token/email workflow.
    const emailBody = { email: "student@example.test" };
    const resetBody = { token: "reset-token", password: "new-password" };
    const verificationBody = { token: "verification-token" };

    // Act: call each endpoint and verify the successful response shape.
    const forgotResponse = await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send(emailBody)
      .expect(200);
    const resetResponse = await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send(resetBody)
      .expect(200);
    const verifyResponse = await request(app.getHttpServer())
      .post("/auth/verify-email")
      .send(verificationBody)
      .expect(200);
    const resendResponse = await request(app.getHttpServer())
      .post("/auth/resend-verification")
      .send(emailBody)
      .expect(200);

    // Assert: HTTP handling delegates and returns non-account-specific messages.
    expect(forgotResponse.body.message).toContain("If an account exists");
    expect(resetResponse.body).toEqual({
      message: "Password reset successfully.",
    });
    expect(verifyResponse.body).toEqual({
      message: "Email verified successfully.",
    });
    expect(resendResponse.body.message).toContain("If the account exists");
    expect(passwordRecoveryServiceMock.forgotPassword).toHaveBeenCalledWith(emailBody.email);
    expect(passwordRecoveryServiceMock.resetPassword).toHaveBeenCalledWith(
      resetBody.token,
      resetBody.password,
    );
    expect(passwordRecoveryServiceMock.verifyEmail).toHaveBeenCalledWith(verificationBody.token);
    expect(passwordRecoveryServiceMock.resendVerification).toHaveBeenCalledWith(emailBody.email);
  });

  it("validates recovery DTOs before calling the service", async () => {
    // Arrange: include an invalid token and an unexpected property.
    const body = { token: "", unexpected: true };

    // Act: submit malformed verification data.
    const response = await request(app.getHttpServer())
      .post("/auth/verify-email")
      .send(body)
      .expect(400);

    // Assert: invalid requests use the stable error shape and are not delegated.
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      path: "/auth/verify-email",
    });
    expect(passwordRecoveryServiceMock.verifyEmail).not.toHaveBeenCalled();
  });

  it("rate-limits verification resends after five requests per minute", async () => {
    // Arrange: prepare a valid verification-resend body.
    const body = { email: "student@example.test" };

    // Act: consume the endpoint's per-IP request allowance.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer()).post("/auth/resend-verification").send(body).expect(200);
    }
    const response = await request(app.getHttpServer())
      .post("/auth/resend-verification")
      .send(body)
      .expect(429);

    // Assert: the extra request uses the standard throttling error response.
    expect(response.body).toMatchObject({
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
      path: "/auth/resend-verification",
    });
  });
});
