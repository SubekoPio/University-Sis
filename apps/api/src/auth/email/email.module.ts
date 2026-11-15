// Purpose: Bind the auth email interface to the Resend implementation.
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EMAIL_SERVICE } from "./email-service.interface.js";
import type { EmailService } from "./email-service.interface.js";
import { MailpitEmailService } from "./mailpit-email.service.js";
import { ResendEmailService } from "./resend-email.service.js";

/** Provides the configured email transport to authentication workflows. */
@Module({
  imports: [ConfigModule],
  providers: [
    ResendEmailService,
    MailpitEmailService,
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService, ResendEmailService, MailpitEmailService],
      useFactory: (
        config: ConfigService,
        resendEmailService: ResendEmailService,
        mailpitEmailService: MailpitEmailService,
      ): EmailService => {
        const provider = config.get<string>("EMAIL_PROVIDER")?.trim().toLowerCase() ?? "resend";

        if (provider === "resend") {
          return resendEmailService;
        }
        if (provider === "mailpit") {
          if (config.get<string>("NODE_ENV") === "production") {
            throw new Error("Mailpit cannot be enabled in production.");
          }
          return mailpitEmailService;
        }

        throw new Error('EMAIL_PROVIDER must be set to either "resend" or "mailpit".');
      },
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
