// Purpose: Persist refresh-token-backed authentication sessions.
import { Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import type { Prisma, Session } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const sessionSelect = {
  id: true,
  userId: true,
  refreshTokenHash: true,
  userAgent: true,
  ip: true,
  expiresAt: true,
  revokedAt: true,
} satisfies Prisma.SessionSelect;

/** Session fields used by authentication flows. */
export type AuthenticationSession = Prisma.SessionGetPayload<{
  select: typeof sessionSelect;
}>;

/** Values needed to create a refresh-token session. */
export type NewAuthenticationSession = Pick<
  Session,
  "id" | "userId" | "refreshTokenHash" | "userAgent" | "ip" | "expiresAt"
>;

/** Performs session persistence operations using Prisma. */
@Injectable()
export class AuthRepository {
  /**
   *
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Looks up a session by its one-way refresh-token hash. */
  findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthenticationSession | null> {
    return this.prisma.session.findUnique({
      where: { refreshTokenHash },
      select: sessionSelect,
    });
  }

  /** Reads the current state of a session by its stable identifier. */
  findById(id: string): Promise<AuthenticationSession | null> {
    return this.prisma.session.findUnique({
      where: { id },
      select: sessionSelect,
    });
  }

  /** Creates a new refresh-token session. */
  createSession(data: NewAuthenticationSession): Promise<AuthenticationSession> {
    return this.prisma.session.create({ data, select: sessionSelect });
  }

  /** Revokes one session and creates its rotated replacement atomically. */
  rotateSession(
    oldSessionId: string,
    replacement: NewAuthenticationSession,
    now: Date,
  ): Promise<AuthenticationSession | null> {
    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.session.updateMany({
        where: {
          id: oldSessionId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        return null;
      }

      return transaction.session.create({
        data: replacement,
        select: sessionSelect,
      });
    });
  }

  /** Revokes a session if it has not already been revoked. */
  async revokeSession(id: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  /** Revokes all active sessions for a user after refresh-token reuse. */
  async revokeAllUserSessions(userId: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  /** Changes a temporary password atomically while preserving only its current session. */
  async completeTemporaryPasswordChange(
    userId: string,
    currentSessionId: string,
    currentPasswordHash: string,
    newPasswordHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const currentSession = await transaction.session.findFirst({
        where: {
          id: currentSessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (currentSession === null) {
        return false;
      }

      const updated = await transaction.user.updateMany({
        where: {
          id: userId,
          status: UserStatus.ACTIVE,
          passwordHash: currentPasswordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: { gt: now },
        },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          emailVerified: true,
        },
      });
      if (updated.count !== 1) {
        return false;
      }

      await transaction.session.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      return true;
    });
  }
}
