// Purpose: Send authentication emails through the Resend SDK.
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { EmailMessage, EmailService } from "./email-service.interface.js";

/** Implements EmailService using the configured Resend account. */
@Injectable()
export class ResendEmailService implements EmailService {
  private readonly resend: Resend | null;
  private readonly fromAddress: string | null;

  /**
   *
   */
  constructor(config: ConfigService) {
    const apiKey = config.get<string>("RESEND_API_KEY")?.trim();
    const fromAddress = config.get<string>("EMAIL_FROM")?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromAddress = fromAddress || null;
  }

  /** Sends one HTML email or surfaces missing/provider configuration. */
  async send(message: EmailMessage): Promise<void> {
    const resend = this.resend;
    const fromAddress = this.fromAddress;
    if (resend === null || fromAddress === null) {
      throw new ServiceUnavailableException("Email delivery is not configured.");
    }

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    if (error !== null) {
      throw new ServiceUnavailableException("The email provider could not accept the message.");
    }
  }
}
