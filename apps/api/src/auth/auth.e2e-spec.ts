// Purpose: Exercise auth HTTP routes and opt-in guards with Supertest.
import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpExceptionFilter } from "../common/http-exception.filter.js";
import { CurrentUser } from "../common/rbac/current-user.decorator.js";
import { Roles } from "../common/rbac/rbac.decorators.js";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { RolesGuard } from "../common/rbac/roles.guard.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import type { AuthenticatedUser, AuthorizationSnapshot } from "../common/rbac/rbac.types.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import type { AuthenticationSession, NewAuthenticationSession } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { EMAIL_SERVICE } from "./email/email-service.interface.js";
import type { EmailService } from "./email/email-service.interface.js";
import { PasswordHashingService } from "./password-hashing.service.js";
import { PasswordRecoveryRepository } from "./password-recovery.repository.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import { UsersService } from "../users/users.service.js";
import type { AuthenticationUser } from "../users/users.repository.js";

const ACCESS_SECRET = "test-only-access-signing-secret-with-32-bytes";

const activeUser: AuthenticationUser = {
  id: "c2d0b38c-26f3-466c-9a9e-6cc361223621",
  email: "student@example.test",
  passwordHash: "argon2-hash",
  status: UserStatus.ACTIVE,
  emailVerified: true,
};

const sessions = new Map<string, AuthenticationSession>();

@Controller("test-protected")
class TestProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)
  getProtected(@CurrentUser() user: AuthenticatedUser): { userId: string } {
    return { userId: user.id };
  }
}

@Controller("test-admin")
class TestAdminController {
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  getAdminOnly(): { allowed: true } {
    return { allowed: true };
  }
}

const usersServiceMock = {
  findForAuthenticationByEmail: vi.fn<UsersService["findForAuthenticationByEmail"]>(),
  findForAuthenticationById: vi.fn<UsersService["findForAuthenticationById"]>(),
  createWithPasswordHash: vi.fn<UsersService["createWithPasswordHash"]>(),
};

const authRepositoryMock = {
  findByRefreshTokenHash: vi.fn<AuthRepository["findByRefreshTokenHash"]>(),
  findById: vi.fn<AuthRepository["findById"]>(),
  createSession: vi.fn<AuthRepository["createSession"]>(),
  rotateSession: vi.fn<AuthRepository["rotateSession"]>(),
  revokeSession: vi.fn<AuthRepository["revokeSession"]>(),
  revokeAllUserSessions: vi.fn<AuthRepository["revokeAllUserSessions"]>(),
};

const passwordHashingMock = {
  hashPassword: vi.fn<PasswordHashingService["hashPassword"]>(),
  verifyPassword: vi.fn<PasswordHashingService["verifyPassword"]>(),
};

const passwordRecoveryRepositoryMock = {
  findUserByEmail: vi.fn<PasswordRecoveryRepository["findUserByEmail"]>(),
  issuePasswordResetToken: vi.fn<PasswordRecoveryRepository["issuePasswordResetToken"]>(),
  hasActivePasswordResetToken: vi.fn<PasswordRecoveryRepository["hasActivePasswordResetToken"]>(),
  consumePasswordResetToken: vi.fn<PasswordRecoveryRepository["consumePasswordResetToken"]>(),
  issueEmailVerificationToken: vi.fn<PasswordRecoveryRepository["issueEmailVerificationToken"]>(),
  verifyEmailToken: vi.fn<PasswordRecoveryRepository["verifyEmailToken"]>(),
};

const emailServiceMock = {
  send: vi.fn<EmailService["send"]>(),
};

const authorizationSnapshot: AuthorizationSnapshot = {
  roles: ["student"],
  permissions: [],
};

const rbacServiceMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
  isActiveSession: vi.fn<RbacService["isActiveSession"]>(),
};

describe("Auth HTTP E2E", () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeEach(async () => {
    vi.resetAllMocks();
    sessions.clear();
    usersServiceMock.findForAuthenticationByEmail.mockImplementation(async (email) =>
      email === activeUser.email ? activeUser : null,
    );
    usersServiceMock.findForAuthenticationById.mockResolvedValue(activeUser);
    passwordHashingMock.verifyPassword.mockImplementation(
      async (passwordHash, password) =>
        passwordHash === activeUser.passwordHash && password === "correct-password",
    );
    authRepositoryMock.findByRefreshTokenHash.mockImplementation(
      async (tokenHash) =>
        [...sessions.values()].find((session) => session.refreshTokenHash === tokenHash) ?? null,
    );
    authRepositoryMock.findById.mockImplementation(async (id) => sessions.get(id) ?? null);
    authRepositoryMock.createSession.mockImplementation(async (data: NewAuthenticationSession) => {
      const session: AuthenticationSession = { ...data, revokedAt: null };
      sessions.set(session.id, session);
      return session;
    });
    authRepositoryMock.rotateSession.mockImplementation(async (oldSessionId, replacement, now) => {
      const previous = sessions.get(oldSessionId);
      if (previous === undefined || previous.revokedAt !== null || previous.expiresAt <= now) {
        return null;
      }

      previous.revokedAt = now;
      const next: AuthenticationSession = {
        ...replacement,
        revokedAt: null,
      };
      sessions.set(next.id, next);
      return next;
    });
    authRepositoryMock.revokeSession.mockImplementation(async (sessionId, now) => {
      const session = sessions.get(sessionId);
      if (session !== undefined && session.revokedAt === null) {
        session.revokedAt = now;
      }
    });
    authRepositoryMock.revokeAllUserSessions.mockImplementation(async (userId, now) => {
      for (const session of sessions.values()) {
        if (session.userId === userId && session.revokedAt === null) {
          session.revokedAt = now;
        }
      }
    });
    passwordRecoveryRepositoryMock.findUserByEmail.mockResolvedValue(null);
    passwordRecoveryRepositoryMock.issuePasswordResetToken.mockResolvedValue();
    passwordRecoveryRepositoryMock.hasActivePasswordResetToken.mockResolvedValue(false);
    passwordRecoveryRepositoryMock.consumePasswordResetToken.mockResolvedValue(false);
    passwordRecoveryRepositoryMock.issueEmailVerificationToken.mockResolvedValue();
    passwordRecoveryRepositoryMock.verifyEmailToken.mockResolvedValue(false);
    emailServiceMock.send.mockResolvedValue();
    rbacServiceMock.getAuthorizationSnapshot.mockResolvedValue(authorizationSnapshot);
    rbacServiceMock.isActiveSession.mockImplementation(async (userId, sessionId) => {
      const session = sessions.get(sessionId);
      return (
        session !== undefined &&
        session.userId === userId &&
        session.revokedAt === null &&
        session.expiresAt > new Date()
      );
    });

    jwtService = new JwtService({
      secret: ACCESS_SECRET,
      signOptions: { algorithm: "HS256" },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [AuthController, TestProtectedController, TestAdminController],
      providers: [
        AuthService,
        PasswordRecoveryService,
        JwtAuthGuard,
        RolesGuard,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AuthRepository, useValue: authRepositoryMock },
        { provide: PasswordHashingService, useValue: passwordHashingMock },
        {
          provide: PasswordRecoveryRepository,
          useValue: passwordRecoveryRepositoryMock,
        },
        { provide: EMAIL_SERVICE, useValue: emailServiceMock },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_ACCESS_TTL_SECONDS: "900",
            AUTH_REFRESH_TTL_SECONDS: "3600",
          }),
        },
        { provide: RbacService, useValue: rbacServiceMock },
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
  });

  afterEach(async () => {
    await app.close();
  });

  it("logs in with valid credentials and returns a token pair", async () => {
    // Arrange: provide valid credentials for the active, verified test account.
    const credentials = {
      email: activeUser.email,
      password: "correct-password",
    };

    // Act: authenticate through the HTTP endpoint.
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send(credentials)
      .expect(200);

    // Assert: the endpoint returns tokens and a safe account summary.
    expect(response.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      tokenType: "Bearer",
      user: {
        id: activeUser.id,
        email: activeUser.email,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
  });

  it("rejects invalid login credentials", async () => {
    // Arrange: provide a wrong password for a known account.
    const credentials = {
      email: activeUser.email,
      password: "incorrect-password",
    };

    // Act / Assert: return the normalized unauthorized response.
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send(credentials)
      .expect(401);

    expect(response.body.code).toBe("UNAUTHORIZED");
    expect(sessions.size).toBe(0);
  });

  it("rotates refresh tokens and rejects reuse of the old token", async () => {
    // Arrange: log in to obtain a refresh token backed by an active session.
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: activeUser.email,
        password: "correct-password",
      })
      .expect(200);

    // Act: rotate the token, then try the original token a second time.
    const rotated = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    const reuse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);

    // Assert: refresh returns a different token and reuse is denied.
    expect(rotated.body.refreshToken).not.toBe(login.body.refreshToken);
    expect(reuse.body.code).toBe("UNAUTHORIZED");
  });

  it("logs out and invalidates the access token session", async () => {
    // Arrange: log in to create a live session and access token.
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: activeUser.email,
        password: "correct-password",
      })
      .expect(200);

    // Act: revoke the session with its refresh token.
    const logout = await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    // Assert: logout succeeds and the former access token no longer authenticates.
    expect(logout.body).toEqual({ success: true });
    await request(app.getHttpServer())
      .get("/test-protected")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(401);
  });

  it("requires authentication and denies users without the required role", async () => {
    // Arrange: an unauthenticated request has no bearer token.
    const missingAuth = await request(app.getHttpServer()).get("/test-protected").expect(401);

    // Act: log in as a student and call a route restricted to admins.
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: activeUser.email,
        password: "correct-password",
      })
      .expect(200);
    const forbidden = await request(app.getHttpServer())
      .get("/test-admin")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(403);

    // Assert: absent identity is 401 and the role mismatch is 403.
    expect(missingAuth.body.code).toBe("UNAUTHORIZED");
    expect(forbidden.body.code).toBe("FORBIDDEN");
  });

  it("rejects an expired access token on a protected route", async () => {
    // Arrange: sign a structurally valid access token with an expired timestamp.
    const expiredToken = await jwtService.signAsync({
      sub: activeUser.id,
      sid: "expired-session",
      email: activeUser.email,
      exp: Math.floor(Date.now() / 1_000) - 1,
    });

    // Act: use the expired token on the protected test route.
    const response = await request(app.getHttpServer())
      .get("/test-protected")
      .set("Authorization", `Bearer ${expiredToken}`)
      .expect(401);

    // Assert: token expiry is translated to the API's normalized auth error.
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});
