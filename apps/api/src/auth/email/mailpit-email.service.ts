// Purpose: Capture authentication emails through a local Mailpit SMTP server.
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { EmailMessage, EmailService } from "./email-service.interface.js";

/** Implements EmailService using a local SMTP capture server. */
@Injectable()
export class MailpitEmailService implements EmailService {
  private readonly host: string;
  private readonly port: number;
  private readonly fromAddress: string | null;

  /**
   *
   */
  constructor(config: ConfigService) {
    this.host = config.get<string>("MAILPIT_HOST")?.trim() || "localhost";
    const portValue = config.get<string>("MAILPIT_SMTP_PORT") ?? "1025";
    this.port = Number(portValue);
    this.fromAddress = config.get<string>("EMAIL_FROM")?.trim() || null;
  }

  /** Delivers a message to Mailpit for local inspection, never to a real inbox. */
  async send(message: EmailMessage): Promise<void> {
    const fromAddress = this.fromAddress;
    if (
      fromAddress === null ||
      !Number.isInteger(this.port) ||
      this.port < 1 ||
      this.port > 65_535
    ) {
      throw new ServiceUnavailableException("Local email capture is not configured.");
    }

    const transport = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: false,
    });
    await transport.sendMail({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  }
}
