// Purpose: Persist password-reset and email-verification token workflows.
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const recoveryUserSelect = {
  id: true,
  email: true,
  status: true,
  emailVerified: true,
} satisfies Prisma.UserSelect;

/** Safe account fields used by recovery and verification workflows. */
export type RecoveryUser = Prisma.UserGetPayload<{
  select: typeof recoveryUserSelect;
}>;

/** Performs recovery-token persistence using Prisma transactions. */
@Injectable()
export class PasswordRecoveryRepository {
  /**
   *
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Finds an account by its normalized email address. */
  findUserByEmail(email: string): Promise<RecoveryUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: recoveryUserSelect,
    });
  }

  /** Creates a reset token after invalidating prior outstanding reset tokens. */
  async issuePasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.passwordResetToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });
  }

  /** Checks a reset token before performing the expensive password hash. */
  async hasActivePasswordResetToken(tokenHash: string, now: Date): Promise<boolean> {
    const token = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });

    return token !== null;
  }

  /** Consumes a reset token, updates the password, and revokes sessions atomically. */
  consumePasswordResetToken(tokenHash: string, passwordHash: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true },
      });
      if (token === null) {
        return false;
      }

      const claimed = await transaction.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        return false;
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });
      await transaction.passwordResetToken.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });

      return true;
    });
  }

  /** Creates a verification token after invalidating prior unused tokens. */
  async issueEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    });
  }

  /** Consumes a valid verification token and marks the account verified atomically. */
  verifyEmailToken(tokenHash: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const token = await transaction.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true },
      });
      if (token === null) {
        return false;
      }

      const claimed = await transaction.emailVerificationToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        return false;
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: { emailVerified: true },
      });
      await transaction.emailVerificationToken.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: now },
      });

      return true;
    });
  }
}
