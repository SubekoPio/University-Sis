// Purpose: Implement internal account registration, login, forced password changes, and session workflows.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserStatus } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AuthenticationUser } from "../users/users.repository.js";
import { UsersService } from "../users/users.service.js";
import { getDurationSeconds } from "./auth.config.js";
import { AuthRepository, NewAuthenticationSession } from "./auth.repository.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import type {
  AuthResult,
  LoginInput,
  RegistrationResult,
  RegisterInput,
  SessionMetadata,
} from "./auth.types.js";
import { PasswordHashingService } from "./password-hashing.service.js";

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;
const MUST_CHANGE_PASSWORD_CODE = "MUST_CHANGE_PASSWORD";

/** Handles authentication workflows and access/refresh-token session lifecycle. */
@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  /**
   *
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly authRepository: AuthRepository,
    private readonly passwordHashing: PasswordHashingService,
    private readonly jwtService: JwtService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
    config: ConfigService,
  ) {
    this.accessTokenTtlSeconds = getDurationSeconds(
      config,
      "JWT_ACCESS_TTL_SECONDS",
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    );
    this.refreshTokenTtlSeconds = getDurationSeconds(
      config,
      "AUTH_REFRESH_TTL_SECONDS",
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    );
  }

  /** Creates an account with an Argon2-hashed password. */
  async register(input: RegisterInput): Promise<RegistrationResult> {
    const email = this.normalizeEmail(input.email);
    this.validatePassword(input.password);
    const passwordHash = await this.passwordHashing.hashPassword(input.password);
    const user = await this.usersService.createWithPasswordHash(email, passwordHash);
    await this.passwordRecoveryService.sendVerificationForNewUser(user.id, user.email);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  /** Verifies credentials, rejects expired temporary passwords, and creates a session. */
  async login(input: LoginInput, metadata: SessionMetadata = {}): Promise<AuthResult> {
    const email = this.normalizeEmail(input.email);
    const user = await this.usersService.findForAuthenticationByEmail(email);
    if (
      user === null ||
      !(await this.passwordHashing.verifyPassword(user.passwordHash, input.password)) ||
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerified
    ) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (
      user.mustChangePassword &&
      (user.temporaryPasswordExpiresAt === null || user.temporaryPasswordExpiresAt <= new Date())
    ) {
      throw new UnauthorizedException(
        "Your temporary password has expired. Contact an administrator.",
      );
    }

    const tokenBundle = await this.prepareTokenBundle(user, metadata);
    await this.authRepository.createSession(tokenBundle.session);

    return { ...tokenBundle.tokens, user: this.toAuthUser(user) };
  }

  /** Rotates a refresh token, restricting forced-change accounts and detecting reuse. */
  async refreshToken(refreshToken: string, metadata: SessionMetadata = {}): Promise<AuthResult> {
    if (refreshToken.length === 0) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const now = new Date();
    const oldSession = await this.authRepository.findByRefreshTokenHash(
      this.hashRefreshToken(refreshToken),
    );
    if (oldSession === null) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    if (oldSession.revokedAt !== null) {
      await this.authRepository.revokeAllUserSessions(oldSession.userId, now);
      throw new UnauthorizedException("Refresh-token reuse detected; sessions were revoked.");
    }

    if (oldSession.expiresAt <= now) {
      await this.authRepository.revokeSession(oldSession.id, now);
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const user = await this.usersService.findForAuthenticationById(oldSession.userId);
    if (user === null || user.status !== UserStatus.ACTIVE) {
      await this.authRepository.revokeAllUserSessions(oldSession.userId, now);
      throw new UnauthorizedException("Invalid refresh token.");
    }
    if (user.mustChangePassword) {
      const expired =
        user.temporaryPasswordExpiresAt === null || user.temporaryPasswordExpiresAt <= now;
      throw new ForbiddenException({
        code: MUST_CHANGE_PASSWORD_CODE,
        message: expired
          ? "Your temporary password has expired. Contact an administrator."
          : "Change your temporary password before refreshing this session.",
      });
    }

    const tokenBundle = await this.prepareTokenBundle(user, {
      ip: metadata.ip ?? oldSession.ip ?? undefined,
      userAgent: metadata.userAgent ?? oldSession.userAgent ?? undefined,
    });
    const rotatedSession = await this.authRepository.rotateSession(
      oldSession.id,
      tokenBundle.session,
      now,
    );

    if (rotatedSession === null) {
      const currentSession = await this.authRepository.findById(oldSession.id);
      if (currentSession !== null && currentSession.revokedAt !== null) {
        await this.authRepository.revokeAllUserSessions(oldSession.userId, now);
        throw new UnauthorizedException("Refresh-token reuse detected; sessions were revoked.");
      }

      throw new UnauthorizedException("Invalid refresh token.");
    }

    return { ...tokenBundle.tokens, user: this.toAuthUser(user) };
  }

  /** Revokes the session identified by a raw refresh token; repeated logout is safe. */
  async logout(refreshToken: string): Promise<void> {
    if (refreshToken.length === 0) {
      return;
    }

    const session = await this.authRepository.findByRefreshTokenHash(
      this.hashRefreshToken(refreshToken),
    );
    if (session !== null) {
      await this.authRepository.revokeSession(session.id, new Date());
    }
  }

  /** Verifies and replaces a temporary password, preserving the current session only. */
  async changeTemporaryPassword(
    userId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findForAuthenticationById(userId);
    if (
      user === null ||
      user.status !== UserStatus.ACTIVE ||
      !(await this.passwordHashing.verifyPassword(user.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException("The current password is incorrect.");
    }

    if (!user.mustChangePassword) {
      throw new BadRequestException("A temporary password change is not required.");
    }

    const temporaryPasswordExpiresAt = user.temporaryPasswordExpiresAt;
    if (temporaryPasswordExpiresAt === null || temporaryPasswordExpiresAt <= new Date()) {
      throw new ForbiddenException({
        code: MUST_CHANGE_PASSWORD_CODE,
        message: "Your temporary password has expired. Contact an administrator.",
      });
    }

    this.validatePassword(newPassword);
    if (await this.passwordHashing.verifyPassword(user.passwordHash, newPassword)) {
      throw new BadRequestException(
        "The new password must be different from the temporary password.",
      );
    }

    const newPasswordHash = await this.passwordHashing.hashPassword(newPassword);
    // Argon2 hashing can cross the expiry boundary, so re-check before persistence.
    const now = new Date();
    if (temporaryPasswordExpiresAt <= now) {
      throw new ForbiddenException({
        code: MUST_CHANGE_PASSWORD_CODE,
        message: "Your temporary password has expired. Contact an administrator.",
      });
    }

    const changed = await this.authRepository.completeTemporaryPasswordChange(
      userId,
      currentSessionId,
      user.passwordHash,
      newPasswordHash,
      now,
    );
    if (!changed) {
      throw new ConflictException("The temporary-password state changed. Sign in again and retry.");
    }
  }

  private async prepareTokenBundle(
    user: AuthenticationUser,
    metadata: SessionMetadata,
  ): Promise<{
    tokens: Omit<AuthResult, "user">;
    session: NewAuthenticationSession;
  }> {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(32).toString("base64url");
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        email: user.email,
      },
      {
        expiresIn: this.accessTokenTtlSeconds,
      },
    );
    const now = new Date();

    return {
      tokens: {
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        expiresIn: this.accessTokenTtlSeconds,
      },
      session: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        userAgent: metadata.userAgent ?? null,
        ip: metadata.ip ?? null,
        expiresAt: new Date(now.getTime() + this.refreshTokenTtlSeconds * 1_000),
      },
    };
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length === 0 || !normalizedEmail.includes("@")) {
      throw new BadRequestException("A valid email address is required.");
    }

    return normalizedEmail;
  }

  private validatePassword(password: string): void {
    if (password.length === 0) {
      throw new BadRequestException("A non-empty password is required.");
    }
  }

  private hashRefreshToken(refreshToken: string): string {
    // Refresh tokens have high entropy, so a fast one-way digest avoids storing bearer secrets.
    return createHash("sha256").update(refreshToken, "utf8").digest("hex");
  }

  private toAuthUser(user: AuthenticationUser): AuthResult["user"] {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
    };
  }
}
