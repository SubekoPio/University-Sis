// Purpose: Test local SMTP delivery and provider selection for Mailpit.
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_SERVICE } from "./email-service.interface.js";
import { EmailModule } from "./email.module.js";
import { MailpitEmailService } from "./mailpit-email.service.js";
import { ResendEmailService } from "./resend-email.service.js";

const { createTransportMock, sendMailMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

describe("MailpitEmailService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({});
  });

  it("sends messages to the configured local SMTP host", async () => {
    // Arrange: configure the local capture server and a non-deliverable sender.
    const service = new MailpitEmailService(
      new ConfigService({
        MAILPIT_HOST: "localhost",
        MAILPIT_SMTP_PORT: "1025",
        EMAIL_FROM: "University SIS <noreply@example.test>",
      }),
    );
    const message = {
      to: "student@example.test",
      subject: "Verify your email",
      html: "<p>Local test message</p>",
    };

    // Act: send one message to Mailpit.
    await service.send(message);

    // Assert: use local SMTP settings and preserve the email content.
    expect(createTransportMock).toHaveBeenCalledWith({
      host: "localhost",
      port: 1025,
      secure: false,
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "University SIS <noreply@example.test>",
      ...message,
    });
  });

  it("rejects invalid local SMTP configuration before attempting delivery", async () => {
    // Arrange: configure a malformed port so no network request can be made.
    const service = new MailpitEmailService(
      new ConfigService({
        MAILPIT_SMTP_PORT: "not-a-port",
        EMAIL_FROM: "University SIS <noreply@example.test>",
      }),
    );

    // Act / Assert: report configuration failure and do not create a transport.
    await expect(
      service.send({
        to: "student@example.test",
        subject: "Verify your email",
        html: "<p>Local test message</p>",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(createTransportMock).not.toHaveBeenCalled();
  });
});

describe("EmailModule provider selection", () => {
  it("selects Mailpit only when explicitly configured for development", async () => {
    // Arrange: select the local provider outside production.
    const config = new ConfigService({
      EMAIL_PROVIDER: "mailpit",
      NODE_ENV: "development",
    });

    // Act: resolve the module's EmailService provider.
    const moduleRef = await Test.createTestingModule({
      imports: [EmailModule],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();

    // Assert: Mailpit is selected instead of the Resend implementation.
    expect(moduleRef.get(EMAIL_SERVICE)).toBeInstanceOf(MailpitEmailService);
    expect(moduleRef.get(EMAIL_SERVICE)).not.toBeInstanceOf(ResendEmailService);
    await moduleRef.close();
  });

  it("refuses to select Mailpit in production", async () => {
    // Arrange: request the local provider in a production environment.
    const config = new ConfigService({
      EMAIL_PROVIDER: "mailpit",
      NODE_ENV: "production",
    });

    // Act / Assert: fail module initialization instead of enabling local email capture.
    await expect(
      Test.createTestingModule({
        imports: [EmailModule],
      })
        .overrideProvider(ConfigService)
        .useValue(config)
        .compile(),
    ).rejects.toThrow("Mailpit cannot be enabled in production.");
  });
});
