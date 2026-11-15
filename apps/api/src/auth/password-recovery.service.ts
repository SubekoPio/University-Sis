// Purpose: Orchestrate password recovery and email verification workflows.
import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { PasswordHashingService } from "./password-hashing.service.js";
import { createEmailVerificationEmail, createPasswordResetEmail } from "./email/email-templates.js";
import { EMAIL_SERVICE } from "./email/email-service.interface.js";
import type { EmailService } from "./email/email-service.interface.js";
import { PasswordRecoveryRepository, RecoveryUser } from "./password-recovery.repository.js";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1_000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1_000;
const FORGOT_PASSWORD_RESPONSE = {
  message: "If an account exists for that email, reset instructions will be sent.",
} as const;
const RESEND_VERIFICATION_RESPONSE = {
  message: "If the account exists and needs verification, instructions will be sent.",
} as const;

/** Coordinates single-use recovery tokens and email notifications. */
@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  /**
   *
   */
  constructor(
    private readonly repository: PasswordRecoveryRepository,
    private readonly passwordHashing: PasswordHashingService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {}

  /** Sends reset instructions when an account exists, always returning the same result. */
  async forgotPassword(email: string): Promise<typeof FORGOT_PASSWORD_RESPONSE> {
    const user = await this.repository.findUserByEmail(this.normalizeEmail(email));
    if (user !== null && user.status === UserStatus.ACTIVE) {
      const now = new Date();
      const token = this.createToken();
      await this.repository.issuePasswordResetToken(
        user.id,
        this.hashToken(token),
        new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        now,
      );

      try {
        await this.emailService.send({
          to: user.email,
          subject: "Reset your University SIS password",
          html: createPasswordResetEmail(token),
        });
      } catch (error: unknown) {
        this.logEmailFailure("Password reset", error);
      }
    }

    return FORGOT_PASSWORD_RESPONSE;
  }

  /** Changes a password once for a valid reset token and revokes all sessions. */
  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    if (!(await this.repository.hasActivePasswordResetToken(tokenHash, now))) {
      throw new BadRequestException("Invalid or expired password reset token.");
    }

    if (password.length === 0) {
      throw new BadRequestException("A non-empty password is required.");
    }

    const passwordHash = await this.passwordHashing.hashPassword(password);
    const consumed = await this.repository.consumePasswordResetToken(tokenHash, passwordHash, now);
    if (!consumed) {
      throw new BadRequestException("Invalid or expired password reset token.");
    }
  }

  /** Verifies an email once using a valid, unexpired token. */
  async verifyEmail(token: string): Promise<void> {
    const verified = await this.repository.verifyEmailToken(this.hashToken(token), new Date());
    if (!verified) {
      throw new BadRequestException("Invalid, expired, or already-used email verification token.");
    }
  }

  /** Sends a verification message after registration. */
  async sendVerificationForNewUser(userId: string, email: string): Promise<void> {
    const now = new Date();
    const token = this.createToken();
    await this.repository.issueEmailVerificationToken(
      userId,
      this.hashToken(token),
      new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
      now,
    );
    await this.emailService.send({
      to: email,
      subject: "Verify your University SIS email",
      html: createEmailVerificationEmail(token),
    });
  }

  /** Sends a new verification message without disclosing account state. */
  async resendVerification(email: string): Promise<typeof RESEND_VERIFICATION_RESPONSE> {
    const user = await this.repository.findUserByEmail(this.normalizeEmail(email));
    if (user !== null && user.status === UserStatus.ACTIVE && !user.emailVerified) {
      await this.issueAndSendVerification(user);
    }

    return RESEND_VERIFICATION_RESPONSE;
  }

  private async issueAndSendVerification(user: RecoveryUser): Promise<void> {
    const now = new Date();
    const token = this.createToken();
    await this.repository.issueEmailVerificationToken(
      user.id,
      this.hashToken(token),
      new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
      now,
    );

    try {
      await this.emailService.send({
        to: user.email,
        subject: "Verify your University SIS email",
        html: createEmailVerificationEmail(token),
      });
    } catch (error: unknown) {
      this.logEmailFailure("Email verification", error);
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private createToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  private logEmailFailure(purpose: string, error: unknown): void {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    this.logger.error(`${purpose} email delivery failed (${errorName}).`);
  }
}
