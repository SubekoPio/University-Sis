// Purpose: Test atomic password-reset persistence and session revocation.
import { Test, TestingModule } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { PasswordRecoveryRepository } from "./password-recovery.repository.js";

const transactionMock = {
  passwordResetToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  session: {
    updateMany: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(
    async (operation: (transaction: typeof transactionMock) => Promise<boolean>) =>
      operation(transactionMock),
  ),
};

describe("PasswordRecoveryRepository", () => {
  let moduleRef: TestingModule;
  let repository: PasswordRecoveryRepository;

  beforeEach(async () => {
    vi.resetAllMocks();
    transactionMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "reset-token-id",
      userId: "user-id",
    });
    transactionMock.passwordResetToken.updateMany.mockResolvedValue({
      count: 1,
    });
    transactionMock.user.update.mockResolvedValue({});
    transactionMock.session.updateMany.mockResolvedValue({ count: 2 });

    moduleRef = await Test.createTestingModule({
      providers: [PasswordRecoveryRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    repository = moduleRef.get(PasswordRecoveryRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("updates the password, consumes the token, and revokes active sessions", async () => {
    // Arrange: prepare an unconsumed token and an active session set.
    const now = new Date("2026-11-15T12:00:00.000Z");

    // Act: atomically consume the token and update the account.
    const consumed = await repository.consumePasswordResetToken("token-hash", "argon2-hash", now);

    // Assert: all writes use the same transaction and only active sessions are revoked.
    expect(consumed).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: "reset-token-id",
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { passwordHash: "argon2-hash" },
    });
    expect(transactionMock.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", revokedAt: null },
      data: { revokedAt: now },
    });
  });

  it("does not change credentials or sessions when token consumption loses a race", async () => {
    // Arrange: another request has already marked the token as used.
    transactionMock.passwordResetToken.updateMany.mockResolvedValue({
      count: 0,
    });

    // Act: attempt to consume the same token again.
    const consumed = await repository.consumePasswordResetToken(
      "token-hash",
      "argon2-hash",
      new Date("2026-11-15T12:00:00.000Z"),
    );

    // Assert: no account or session writes occur after the conditional claim fails.
    expect(consumed).toBe(false);
    expect(transactionMock.user.update).not.toHaveBeenCalled();
    expect(transactionMock.session.updateMany).not.toHaveBeenCalled();
  });

  it("allows a password reset token to be consumed only once", async () => {
    // Arrange: the first token claim succeeds and the later reuse claim fails.
    transactionMock.passwordResetToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const now = new Date("2026-11-15T12:00:00.000Z");

    // Act: attempt to reset the password twice with the same token digest.
    const firstUse = await repository.consumePasswordResetToken(
      "token-hash",
      "first-password-hash",
      now,
    );
    const secondUse = await repository.consumePasswordResetToken(
      "token-hash",
      "second-password-hash",
      now,
    );

    // Assert: only the first claim changes the account and active sessions.
    expect(firstUse).toBe(true);
    expect(secondUse).toBe(false);
    expect(transactionMock.user.update).toHaveBeenCalledTimes(1);
    expect(transactionMock.session.updateMany).toHaveBeenCalledTimes(1);
  });
});
