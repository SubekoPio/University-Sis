// Purpose: Test authentication service token and session lifecycle behavior.
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { UserStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRepository } from "./auth.repository.js";
import type { AuthenticationSession, NewAuthenticationSession } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { PasswordHashingService } from "./password-hashing.service.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import { UsersService } from "../users/users.service.js";
import type { AuthenticationUser } from "../users/users.repository.js";

const ACCESS_SECRET = "test-only-access-signing-secret-with-32-bytes";
const refreshTokenHash = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

const activeUser: AuthenticationUser = {
  id: "c2d0b38c-26f3-466c-9a9e-6cc361223621",
  email: "student@example.test",
  passwordHash: "argon2-hash",
  status: UserStatus.ACTIVE,
  emailVerified: true,
};

const asSession = (session: NewAuthenticationSession): AuthenticationSession => ({
  ...session,
  revokedAt: null,
});

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

const passwordRecoveryServiceMock = {
  sendVerificationForNewUser: vi.fn<PasswordRecoveryService["sendVerificationForNewUser"]>(),
};

describe("AuthService", () => {
  let moduleRef: TestingModule;
  let authService: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    vi.resetAllMocks();
    jwtService = new JwtService({ secret: ACCESS_SECRET });

    moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AuthRepository, useValue: authRepositoryMock },
        { provide: PasswordHashingService, useValue: passwordHashingMock },
        {
          provide: PasswordRecoveryService,
          useValue: passwordRecoveryServiceMock,
        },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            JWT_ACCESS_TTL_SECONDS: "900",
            AUTH_REFRESH_TTL_SECONDS: "3600",
          }),
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("hashes the password and returns only safe fields during registration", async () => {
    // Arrange: make the user service return the safe record from account creation.
    passwordHashingMock.hashPassword.mockResolvedValue("new-argon2-hash");
    usersServiceMock.createWithPasswordHash.mockResolvedValue({
      id: activeUser.id,
      email: activeUser.email,
      status: UserStatus.ACTIVE,
      emailVerified: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    passwordRecoveryServiceMock.sendVerificationForNewUser.mockResolvedValue();

    // Act: register using mixed-case email input.
    const result = await authService.register({
      email: "  STUDENT@EXAMPLE.TEST ",
      password: "new-password",
    });

    // Assert: only a hash reaches user persistence and the response is password-free.
    expect(passwordHashingMock.hashPassword).toHaveBeenCalledWith("new-password");
    expect(usersServiceMock.createWithPasswordHash).toHaveBeenCalledWith(
      activeUser.email,
      "new-argon2-hash",
    );
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.email).toBe(activeUser.email);
    expect(result.emailVerified).toBe(false);
    expect(passwordRecoveryServiceMock.sendVerificationForNewUser).toHaveBeenCalledWith(
      activeUser.id,
      activeUser.email,
    );
  });

  it("verifies login credentials and stores only a refresh-token digest", async () => {
    // Arrange: provide a valid active account and successful password verification.
    usersServiceMock.findForAuthenticationByEmail.mockResolvedValue(activeUser);
    passwordHashingMock.verifyPassword.mockResolvedValue(true);
    authRepositoryMock.createSession.mockImplementation(async (session) => asSession(session));

    // Act: log in with an email that requires normalization.
    const result = await authService.login({
      email: "  STUDENT@EXAMPLE.TEST ",
      password: "correct-password",
    });

    // Assert: the access JWT is signed for the account and only the digest is persisted.
    const claims = await jwtService.verifyAsync<{
      sub: string;
      sid: string;
      email: string;
      iat: number;
      exp: number;
    }>(result.accessToken);
    expect(claims).toMatchObject({
      sub: activeUser.id,
      sid: expect.any(String),
      email: activeUser.email,
    });
    expect(claims.exp - claims.iat).toBe(900);

    const createCall = authRepositoryMock.createSession.mock.calls.at(0);
    if (createCall === undefined) {
      throw new Error("Expected login to create a session.");
    }

    expect(createCall[0].refreshTokenHash).toBe(refreshTokenHash(result.refreshToken));
    expect(createCall[0].refreshTokenHash).not.toBe(result.refreshToken);
    expect(result.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    });
  });

  it("rejects login when the account email is unverified", async () => {
    // Arrange: account credentials are valid but the email has not been verified.
    usersServiceMock.findForAuthenticationByEmail.mockResolvedValue({
      ...activeUser,
      emailVerified: false,
    });

    // Act / Assert: deny login without creating an authenticated session.
    await expect(
      authService.login({
        email: activeUser.email,
        password: "correct-password",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepositoryMock.createSession).not.toHaveBeenCalled();
  });

  it("rejects login when the password does not match", async () => {
    // Arrange: find the account but fail password verification.
    usersServiceMock.findForAuthenticationByEmail.mockResolvedValue(activeUser);
    passwordHashingMock.verifyPassword.mockResolvedValue(false);

    // Act / Assert: deny the request without creating a session.
    await expect(
      authService.login({
        email: activeUser.email,
        password: "incorrect-password",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepositoryMock.createSession).not.toHaveBeenCalled();
  });

  it("rotates the refresh token and revokes the old session atomically", async () => {
    // Arrange: an unexpired session and active account are available for rotation.
    const oldToken = "existing-refresh-token";
    const oldSession: AuthenticationSession = {
      id: "old-session",
      userId: activeUser.id,
      refreshTokenHash: refreshTokenHash(oldToken),
      userAgent: "browser",
      ip: "192.0.2.1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    };
    authRepositoryMock.findByRefreshTokenHash.mockResolvedValue(oldSession);
    usersServiceMock.findForAuthenticationById.mockResolvedValue(activeUser);
    authRepositoryMock.rotateSession.mockImplementation(async (_oldId, replacement) =>
      asSession(replacement),
    );

    // Act: refresh with a new observed IP address.
    const result = await authService.refreshToken(oldToken, {
      ip: "192.0.2.2",
    });

    // Assert: a different token digest and session replace the old one.
    const rotateCall = authRepositoryMock.rotateSession.mock.calls.at(0);
    if (rotateCall === undefined) {
      throw new Error("Expected refresh to rotate the session.");
    }

    expect(rotateCall[0]).toBe(oldSession.id);
    expect(rotateCall[1].refreshTokenHash).toBe(refreshTokenHash(result.refreshToken));
    expect(rotateCall[1].refreshTokenHash).not.toBe(oldSession.refreshTokenHash);
    expect(rotateCall[1].userAgent).toBe(oldSession.userAgent);
    expect(rotateCall[1].ip).toBe("192.0.2.2");
  });

  it("revokes all active sessions when a revoked refresh token is reused", async () => {
    // Arrange: the supplied token belongs to a session that was already revoked.
    const oldToken = "replayed-refresh-token";
    authRepositoryMock.findByRefreshTokenHash.mockResolvedValue({
      id: "revoked-session",
      userId: activeUser.id,
      refreshTokenHash: refreshTokenHash(oldToken),
      userAgent: null,
      ip: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    // Act / Assert: reuse is rejected and remaining sessions are revoked.
    await expect(authService.refreshToken(oldToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepositoryMock.revokeAllUserSessions).toHaveBeenCalledWith(
      activeUser.id,
      expect.any(Date),
    );
  });

  it("rejects and revokes an expired refresh token", async () => {
    // Arrange: provide a session whose expiration time is already past.
    const token = "expired-refresh-token";
    const expiredSession: AuthenticationSession = {
      id: "expired-session",
      userId: activeUser.id,
      refreshTokenHash: refreshTokenHash(token),
      userAgent: null,
      ip: null,
      expiresAt: new Date(Date.now() - 1),
      revokedAt: null,
    };
    authRepositoryMock.findByRefreshTokenHash.mockResolvedValue(expiredSession);

    // Act / Assert: reject the expired token and revoke its session.
    await expect(authService.refreshToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authRepositoryMock.revokeSession).toHaveBeenCalledWith(
      expiredSession.id,
      expect.any(Date),
    );
    expect(usersServiceMock.findForAuthenticationById).not.toHaveBeenCalled();
  });

  it("revokes only the session named by the refresh token on logout", async () => {
    // Arrange: the token resolves to one active session.
    const token = "logout-refresh-token";
    authRepositoryMock.findByRefreshTokenHash.mockResolvedValue({
      id: "logout-session",
      userId: activeUser.id,
      refreshTokenHash: refreshTokenHash(token),
      userAgent: null,
      ip: null,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    // Act: log out with the raw token.
    await authService.logout(token);

    // Assert: only that session is revoked.
    expect(authRepositoryMock.revokeSession).toHaveBeenCalledWith(
      "logout-session",
      expect.any(Date),
    );
    expect(authRepositoryMock.revokeAllUserSessions).not.toHaveBeenCalled();
  });
});
