// Purpose: Implement registration, login, refresh rotation, and logout workflows.
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
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

/** Handles authentication workflows and refresh-token session lifecycle. */
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

  /** Verifies credentials and creates a refresh-token-backed session. */
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

    const tokenBundle = await this.prepareTokenBundle(user, metadata);
    await this.authRepository.createSession(tokenBundle.session);

    return { ...tokenBundle.tokens, user: this.toAuthUser(user) };
  }

  /** Rotates a refresh token, revoking the prior session and detecting reuse. */
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
