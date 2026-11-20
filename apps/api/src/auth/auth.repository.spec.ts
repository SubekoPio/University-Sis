// Purpose: Verify atomic forced-password updates and preservation of the current session.
import { Test, TestingModule } from "@nestjs/testing";
import { UserStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { AuthRepository } from "./auth.repository.js";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const USER_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const CURRENT_SESSION_ID = "current-session";

const transactionMock = {
  session: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    updateMany: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(
    async (operation: (transaction: typeof transactionMock) => Promise<unknown>) =>
      operation(transactionMock),
  ),
};

describe("AuthRepository", () => {
  let moduleRef: TestingModule;
  let repository: AuthRepository;

  beforeEach(async () => {
    vi.resetAllMocks();
    transactionMock.session.findFirst.mockResolvedValue({
      id: CURRENT_SESSION_ID,
    });
    transactionMock.session.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.user.updateMany.mockResolvedValue({ count: 1 });

    moduleRef = await Test.createTestingModule({
      providers: [AuthRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    repository = moduleRef.get(AuthRepository);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("updates password state and revokes every other active session transactionally", async () => {
    // Arrange: use valid current-session and unexpired temporary-password state.

    // Act: complete the forced-password change.
    const changed = await repository.completeTemporaryPasswordChange(
      USER_ID,
      CURRENT_SESSION_ID,
      "temporary-password-hash",
      "replacement-password-hash",
      NOW,
    );

    // Assert: the account is verified and forced-change state clears in the same transaction.
    expect(changed).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMock.session.findFirst).toHaveBeenCalledWith({
      where: {
        id: CURRENT_SESSION_ID,
        userId: USER_ID,
        revokedAt: null,
        expiresAt: { gt: NOW },
      },
      select: { id: true },
    });
    expect(transactionMock.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: USER_ID,
        status: UserStatus.ACTIVE,
        passwordHash: "temporary-password-hash",
        mustChangePassword: true,
        temporaryPasswordExpiresAt: { gt: NOW },
      },
      data: {
        passwordHash: "replacement-password-hash",
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        emailVerified: true,
      },
    });
    expect(transactionMock.session.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        id: { not: CURRENT_SESSION_ID },
        revokedAt: null,
      },
      data: { revokedAt: NOW },
    });
  });

  it("leaves password state untouched when the current session is inactive", async () => {
    // Arrange: make the session check fail before attempting to update the account.
    transactionMock.session.findFirst.mockResolvedValue(null);

    // Act: attempt the password change with an inactive session.
    const changed = await repository.completeTemporaryPasswordChange(
      USER_ID,
      CURRENT_SESSION_ID,
      "temporary-password-hash",
      "replacement-password-hash",
      NOW,
    );

    // Assert: no account write or other-session revocation occurs.
    expect(changed).toBe(false);
    expect(transactionMock.user.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.session.updateMany).not.toHaveBeenCalled();
  });

  it("does not revoke other sessions when the account changed concurrently", async () => {
    // Arrange: allow the session check but reject the conditional account update.
    transactionMock.user.updateMany.mockResolvedValue({ count: 0 });

    // Act: attempt the stale password change.
    const changed = await repository.completeTemporaryPasswordChange(
      USER_ID,
      CURRENT_SESSION_ID,
      "stale-temporary-password-hash",
      "replacement-password-hash",
      NOW,
    );

    // Assert: the transaction returns a conflict signal without revoking sessions.
    expect(changed).toBe(false);
    expect(transactionMock.session.updateMany).not.toHaveBeenCalled();
  });
});
