// Purpose: Exercise Phase 1 registration removal and temporary-password session lifecycle over HTTP.
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
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { MustChangePasswordGuard } from "../common/rbac/must-change-password.guard.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import type { AuthenticatedUser } from "../common/rbac/rbac.types.js";
import { UsersService } from "../users/users.service.js";
import type { AuthenticationUser } from "../users/users.repository.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import type { AuthenticationSession, NewAuthenticationSession } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import { PasswordHashingService } from "./password-hashing.service.js";

const ACCESS_SECRET = "test-only-access-signing-secret-with-32-bytes";
const USER_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";

@Controller("phase1-protected")
class Phase1ProtectedController {
  /** Exposes an authenticated route to verify a changed account returns to normal access. */
  @Get()
  @UseGuards(JwtAuthGuard)
  getProtected(@CurrentUser() user: AuthenticatedUser): {
    userId: string;
  } {
    return { userId: user.id };
  }
}

const temporaryUser: AuthenticationUser = {
  id: USER_ID,
  email: "staff@example.test",
  passwordHash: "temporary-password-hash",
  status: UserStatus.ACTIVE,
  emailVerified: true,
  mustChangePassword: false,
  temporaryPasswordExpiresAt: null,
};

const sessions = new Map<string, AuthenticationSession>();
const knownPasswords = new Map<string, string>([["temporary-password-hash", "temporary-password"]]);

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
  completeTemporaryPasswordChange: vi.fn<AuthRepository["completeTemporaryPasswordChange"]>(),
};

const passwordHashingMock = {
  hashPassword: vi.fn<PasswordHashingService["hashPassword"]>(),
  verifyPassword: vi.fn<PasswordHashingService["verifyPassword"]>(),
};

const passwordRecoveryServiceMock = {
  sendVerificationForNewUser: vi.fn<PasswordRecoveryService["sendVerificationForNewUser"]>(),
  forgotPassword: vi.fn<PasswordRecoveryService["forgotPassword"]>(),
  resetPassword: vi.fn<PasswordRecoveryService["resetPassword"]>(),
  verifyEmail: vi.fn<PasswordRecoveryService["verifyEmail"]>(),
  resendVerification: vi.fn<PasswordRecoveryService["resendVerification"]>(),
};

const rbacServiceMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
  isActiveSession: vi.fn<RbacService["isActiveSession"]>(),
};

describe("Phase 1 authentication updates E2E", () => {
  let app: INestApplication;
  let currentUser: AuthenticationUser;
  let jwtService: JwtService;
  let passwordSequence: number;

  beforeEach(async () => {
    vi.resetAllMocks();
    sessions.clear();
    knownPasswords.clear();
    knownPasswords.set("temporary-password-hash", "temporary-password");
    currentUser = {
      ...temporaryUser,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
    };
    passwordSequence = 0;

    usersServiceMock.findForAuthenticationByEmail.mockImplementation(async (email) =>
      email === currentUser.email ? currentUser : null,
    );
    usersServiceMock.findForAuthenticationById.mockImplementation(async (id) =>
      id === currentUser.id ? currentUser : null,
    );
    passwordHashingMock.verifyPassword.mockImplementation(
      async (hash, password) => knownPasswords.get(hash) === password,
    );
    passwordHashingMock.hashPassword.mockImplementation(async (password) => {
      const hash = `replacement-hash-${passwordSequence}`;
      passwordSequence += 1;
      knownPasswords.set(hash, password);
      return hash;
    });
    authRepositoryMock.createSession.mockImplementation(async (input: NewAuthenticationSession) => {
      const session: AuthenticationSession = { ...input, revokedAt: null };
      sessions.set(session.id, session);
      return session;
    });
    authRepositoryMock.findByRefreshTokenHash.mockImplementation(
      async (hash) =>
        [...sessions.values()].find((session) => session.refreshTokenHash === hash) ?? null,
    );
    authRepositoryMock.findById.mockImplementation(async (id) => sessions.get(id) ?? null);
    authRepositoryMock.revokeSession.mockImplementation(async (id, now) => {
      const session = sessions.get(id);
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
    authRepositoryMock.rotateSession.mockImplementation(async (oldId, replacement, now) => {
      const oldSession = sessions.get(oldId);
      if (
        oldSession === undefined ||
        oldSession.revokedAt !== null ||
        oldSession.expiresAt <= now
      ) {
        return null;
      }
      oldSession.revokedAt = now;
      const next: AuthenticationSession = {
        ...replacement,
        revokedAt: null,
      };
      sessions.set(next.id, next);
      return next;
    });
    authRepositoryMock.completeTemporaryPasswordChange.mockImplementation(
      async (userId, sessionId, currentHash, replacementHash, now) => {
        if (
          currentUser.id !== userId ||
          currentUser.passwordHash !== currentHash ||
          !currentUser.mustChangePassword
        ) {
          return false;
        }
        currentUser = {
          ...currentUser,
          passwordHash: replacementHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          emailVerified: true,
        };
        for (const session of sessions.values()) {
          if (session.userId === userId && session.id !== sessionId && session.revokedAt === null) {
            session.revokedAt = now;
          }
        }
        return true;
      },
    );
    rbacServiceMock.isActiveSession.mockImplementation(async (userId, sessionId) => {
      const session = sessions.get(sessionId);
      return (
        session !== undefined &&
        session.userId === userId &&
        session.revokedAt === null &&
        session.expiresAt > new Date()
      );
    });
    rbacServiceMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: [],
    });
    passwordRecoveryServiceMock.forgotPassword.mockResolvedValue({
      message: "If an account exists for that email, reset instructions will be sent.",
    });
    passwordRecoveryServiceMock.resendVerification.mockResolvedValue({
      message: "If the account exists and needs verification, instructions will be sent.",
    });
    passwordRecoveryServiceMock.resetPassword.mockResolvedValue();
    passwordRecoveryServiceMock.verifyEmail.mockResolvedValue();
    passwordRecoveryServiceMock.sendVerificationForNewUser.mockResolvedValue();

    jwtService = new JwtService({
      secret: ACCESS_SECRET,
      signOptions: { algorithm: "HS256" },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [AuthController, Phase1ProtectedController],
      providers: [
        AuthService,
        JwtAuthGuard,
        MustChangePasswordGuard,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AuthRepository, useValue: authRepositoryMock },
        { provide: PasswordHashingService, useValue: passwordHashingMock },
        { provide: JwtService, useValue: jwtService },
        {
          provide: PasswordRecoveryService,
          useValue: passwordRecoveryServiceMock,
        },
        { provide: RbacService, useValue: rbacServiceMock },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_ACCESS_TTL_SECONDS: "900",
            AUTH_REFRESH_TTL_SECONDS: "3600",
          }),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(moduleRef.get(MustChangePasswordGuard));
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

  it("keeps public registration unavailable", async () => {
    // Arrange: prepare a request that would have registered a public account.
    const registration = {
      email: "new-staff@example.test",
      password: "valid-password",
    };

    // Act: post to the removed public registration route.
    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .send(registration)
      .expect(404);

    // Assert: the route is absent and no account-creation method was called.
    expect(response.body.code).toBe("NOT_FOUND");
    expect(usersServiceMock.createWithPasswordHash).not.toHaveBeenCalled();
  });

  it("restricts temporary sessions, then preserves only the changed session", async () => {
    // Arrange: sign in three times with the active temporary credentials.
    const login = async () =>
      request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: currentUser.email,
          password: "temporary-password",
        })
        .expect(200);
    const changingSession = await login();
    const oldSession = await login();
    const logoutSession = await login();

    // Act: reject ordinary access, allow logout and password change, then retry with both sessions.
    const protectedResponse = await request(app.getHttpServer())
      .get("/phase1-protected")
      .set("Authorization", `Bearer ${changingSession.body.accessToken}`)
      .expect(403);
    const recoveryResponse = await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .set("Authorization", `Bearer ${changingSession.body.accessToken}`)
      .send({ email: currentUser.email })
      .expect(403);
    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Authorization", `Bearer ${changingSession.body.accessToken}`)
      .send({ refreshToken: changingSession.body.refreshToken })
      .expect(403);
    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${logoutSession.body.accessToken}`)
      .send({ refreshToken: logoutSession.body.refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${changingSession.body.accessToken}`)
      .send({
        currentPassword: "temporary-password",
        newPassword: "replacement-password",
      })
      .expect(200);
    const normalAccessResponse = await request(app.getHttpServer())
      .get("/phase1-protected")
      .set("Authorization", `Bearer ${changingSession.body.accessToken}`)
      .expect(200);
    const revokedOldSessionResponse = await request(app.getHttpServer())
      .get("/phase1-protected")
      .set("Authorization", `Bearer ${oldSession.body.accessToken}`)
      .expect(401);

    // Assert: denied routes carry the stable code; the changed session remains active and its peer is revoked.
    expect(protectedResponse.body.code).toBe("MUST_CHANGE_PASSWORD");
    expect(recoveryResponse.body.code).toBe("MUST_CHANGE_PASSWORD");
    expect(refreshResponse.body.code).toBe("MUST_CHANGE_PASSWORD");
    expect(normalAccessResponse.body).toEqual({ userId: USER_ID });
    expect(revokedOldSessionResponse.body.code).toBe("UNAUTHORIZED");
    expect(currentUser.mustChangePassword).toBe(false);
    expect(
      [...sessions.values()].filter(
        (session) => session.userId === USER_ID && session.revokedAt === null,
      ),
    ).toHaveLength(1);
  });
});
