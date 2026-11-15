// Purpose: Test account-recovery token handling and email-delivery behavior.
import { BadRequestException, Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { UserStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordHashingService } from "./password-hashing.service.js";
import { PasswordRecoveryRepository } from "./password-recovery.repository.js";
import type { RecoveryUser } from "./password-recovery.repository.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";
import { EMAIL_SERVICE } from "./email/email-service.interface.js";
import type { EmailService } from "./email/email-service.interface.js";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const resetTokenHash = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

const recoveryUser: RecoveryUser = {
  id: "c2d0b38c-26f3-466c-9a9e-6cc361223621",
  email: "student@example.test",
  status: UserStatus.ACTIVE,
  emailVerified: false,
};

const repositoryMock = {
  findUserByEmail: vi.fn<PasswordRecoveryRepository["findUserByEmail"]>(),
  issuePasswordResetToken: vi.fn<PasswordRecoveryRepository["issuePasswordResetToken"]>(),
  hasActivePasswordResetToken: vi.fn<PasswordRecoveryRepository["hasActivePasswordResetToken"]>(),
  consumePasswordResetToken: vi.fn<PasswordRecoveryRepository["consumePasswordResetToken"]>(),
  issueEmailVerificationToken: vi.fn<PasswordRecoveryRepository["issueEmailVerificationToken"]>(),
  verifyEmailToken: vi.fn<PasswordRecoveryRepository["verifyEmailToken"]>(),
};

const passwordHashingMock = {
  hashPassword: vi.fn<PasswordHashingService["hashPassword"]>(),
};

const emailServiceMock = {
  send: vi.fn<EmailService["send"]>(),
};

describe("PasswordRecoveryService", () => {
  let moduleRef: TestingModule;
  let service: PasswordRecoveryService;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    repositoryMock.findUserByEmail.mockResolvedValue(recoveryUser);
    repositoryMock.issuePasswordResetToken.mockResolvedValue();
    repositoryMock.hasActivePasswordResetToken.mockResolvedValue(true);
    repositoryMock.consumePasswordResetToken.mockResolvedValue(true);
    repositoryMock.issueEmailVerificationToken.mockResolvedValue();
    repositoryMock.verifyEmailToken.mockResolvedValue(true);
    passwordHashingMock.hashPassword.mockResolvedValue("argon2-password-hash");
    emailServiceMock.send.mockResolvedValue();

    moduleRef = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
        { provide: PasswordRecoveryRepository, useValue: repositoryMock },
        { provide: PasswordHashingService, useValue: passwordHashingMock },
        { provide: EMAIL_SERVICE, useValue: emailServiceMock },
      ],
    }).compile();
    service = moduleRef.get(PasswordRecoveryService);
  });

  afterEach(async () => {
    await moduleRef.close();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the same forgot-password response when email delivery fails", async () => {
    // Arrange: make a matching active account whose email provider rejects delivery.
    const loggerErrorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    repositoryMock.findUserByEmail.mockResolvedValueOnce(recoveryUser).mockResolvedValueOnce(null);
    emailServiceMock.send.mockRejectedValue(new Error("provider failure"));

    // Act: request recovery once for a known account and once for an unknown one.
    const knownAccountResult = await service.forgotPassword(" STUDENT@EXAMPLE.TEST ");
    const unknownAccountResult = await service.forgotPassword("missing@example.test");

    // Assert: both responses are identical and only a token digest is persisted.
    expect(knownAccountResult).toEqual(unknownAccountResult);
    expect(repositoryMock.findUserByEmail).toHaveBeenNthCalledWith(1, recoveryUser.email);
    const sentEmail = emailServiceMock.send.mock.calls[0]?.[0];
    const issueCall = repositoryMock.issuePasswordResetToken.mock.calls[0];
    if (sentEmail === undefined || issueCall === undefined) {
      throw new Error("Expected reset token issuance and email delivery attempt.");
    }

    const tokenMatch = sentEmail.html.match(/<code>([^<]+)<\/code>/);
    const rawToken = tokenMatch?.[1];
    if (rawToken === undefined) {
      throw new Error("Expected the reset email to contain its token.");
    }

    expect(issueCall[1]).toBe(resetTokenHash(rawToken));
    expect(issueCall[1]).not.toBe(rawToken);
    expect(issueCall[2]).toEqual(new Date(NOW.getTime() + 60 * 60 * 1_000));
    expect(loggerErrorSpy).toHaveBeenCalledWith("Password reset email delivery failed (Error).");
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining(rawToken));
  });

  it("hashes a new password and asks the repository to consume the reset token", async () => {
    // Arrange: provide a valid reset token and a successful atomic consumption.
    const token = "one-time-reset-token";

    // Act: reset the account password with the token.
    await service.resetPassword(token, "new-password");

    // Assert: only a password hash and token digest reach persistence.
    expect(passwordHashingMock.hashPassword).toHaveBeenCalledWith("new-password");
    expect(repositoryMock.hasActivePasswordResetToken).toHaveBeenCalledWith(
      resetTokenHash(token),
      NOW,
    );
    expect(repositoryMock.consumePasswordResetToken).toHaveBeenCalledWith(
      resetTokenHash(token),
      "argon2-password-hash",
      NOW,
    );
  });

  it("rejects invalid reset tokens before hashing the replacement password", async () => {
    // Arrange: the repository reports no active token for the supplied digest.
    repositoryMock.hasActivePasswordResetToken.mockResolvedValue(false);

    // Act / Assert: reject without hashing or changing the password.
    await expect(service.resetPassword("expired-token", "new-password")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(passwordHashingMock.hashPassword).not.toHaveBeenCalled();
    expect(repositoryMock.consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it("issues a hashed verification token that expires after 24 hours", async () => {
    // Arrange: use a newly registered account with an unverified address.
    const email = "new@example.test";

    // Act: send its initial verification email.
    await service.sendVerificationForNewUser(recoveryUser.id, email);

    // Assert: store only the digest with the required lifetime.
    const sentEmail = emailServiceMock.send.mock.calls[0]?.[0];
    const issueCall = repositoryMock.issueEmailVerificationToken.mock.calls[0];
    if (sentEmail === undefined || issueCall === undefined) {
      throw new Error("Expected verification token issuance and email delivery.");
    }

    const tokenMatch = sentEmail.html.match(/<code>([^<]+)<\/code>/);
    const rawToken = tokenMatch?.[1];
    if (rawToken === undefined) {
      throw new Error("Expected the verification email to contain its token.");
    }

    expect(issueCall[1]).toBe(resetTokenHash(rawToken));
    expect(issueCall[1]).not.toBe(rawToken);
    expect(issueCall[2]).toEqual(new Date(NOW.getTime() + 24 * 60 * 60 * 1_000));
    expect(sentEmail.to).toBe(email);
  });

  it("rejects verification tokens the repository cannot consume", async () => {
    // Arrange: simulate an expired or previously consumed verification token.
    repositoryMock.verifyEmailToken.mockResolvedValue(false);

    // Act / Assert: reject the token instead of reporting success.
    await expect(service.verifyEmail("used-token")).rejects.toBeInstanceOf(BadRequestException);
    expect(repositoryMock.verifyEmailToken).toHaveBeenCalledWith(resetTokenHash("used-token"), NOW);
  });
});
