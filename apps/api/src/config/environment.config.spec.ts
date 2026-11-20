// Purpose: Test startup validation and parsing for API environment settings.
import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./environment.config.js";

const validEnvironment: Record<string, unknown> = {
  APP_URL: "https://sis.example",
  EMAIL_FROM: "University SIS <noreply@example.test>",
  EMAIL_PROVIDER: "mailpit",
  WEBSITE_INTEGRATION_SECRET: "a".repeat(32),
  MEETING_ALLOWED_HOSTS: "Meet.University.Example, zoom.us",
  APPLICATION_FEE_AMOUNT_MINOR: "15000",
  CURRENCY: "UGX",
  SCHOOL_NAME: "University SIS",
  SCHOOL_LOGO_KEY: "branding/school-logo.svg",
};

describe("validateEnvironment", () => {
  it("applies safe defaults, normalizes hosts, and retains existing variables", () => {
    // Arrange: include an unrelated existing setting to protect passthrough behavior.
    const configuration = {
      ...validEnvironment,
      DATABASE_URL: "postgresql://db.example",
    };

    // Act: parse all values before Nest modules initialize.
    const environment = validateEnvironment(configuration);

    // Assert: defaults are typed, hosts normalized, and existing settings retained.
    expect(environment.TEMP_PASSWORD_TTL_DAYS).toBe(7);
    expect(environment.ATTENDANCE_MIN_CONTINUOUS_PERCENT).toBe(75);
    expect(environment.ATTENDANCE_RECONNECT_GRACE_SECONDS).toBe(180);
    expect(environment.ATTENDANCE_WARNING_PERCENT).toBe(75);
    expect(environment.MEETING_ALLOWED_HOSTS).toEqual(["meet.university.example", "zoom.us"]);
    expect(environment.FEATURE_ONLINE_CARD_ENABLED).toBe(false);
    expect(environment.FEATURE_ONLINE_BANK_ENABLED).toBe(false);
    expect(environment.FEATURE_ONLINE_MOBILE_ENABLED).toBe(false);
    expect(environment.DATABASE_URL).toBe("postgresql://db.example");
  });

  it("fails when a required value is missing", () => {
    // Arrange: omit the public URL required to create email login links.
    const { APP_URL: _appUrl, ...missingUrl } = validEnvironment;

    // Act / Assert: missing settings fail before dependent services initialize.
    expect(() => validateEnvironment(missingUrl)).toThrow();
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APPLICATION_FEE_AMOUNT_MINOR: "",
      }),
    ).toThrow();
  });

  it("rejects non-HTTP app URLs and malformed meeting hosts", () => {
    // Arrange: use URL-like values where plain HTTP URLs and hostnames are required.

    // Act / Assert: reject invalid settings before application startup.
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_URL: "ftp://sis.example",
      }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MEETING_ALLOWED_HOSTS: "https://meet.university.example",
      }),
    ).toThrow();
  });

  it("requires a Resend API key only when Resend is selected", () => {
    // Arrange: keep Resend optional for the existing local Mailpit workflow.
    const mailpitEnvironment = validateEnvironment(validEnvironment);

    // Act / Assert: the existing default provider still requires its credentials.
    expect(mailpitEnvironment.RESEND_API_KEY).toBe("");
    expect(() => validateEnvironment({ ...validEnvironment, EMAIL_PROVIDER: "resend" })).toThrow(
      /RESEND_API_KEY/,
    );
  });

  it("rejects enabling any online-payment seed flag", () => {
    // Arrange: try to enable one future online payment method in configuration.
    const configuration = {
      ...validEnvironment,
      FEATURE_ONLINE_BANK_ENABLED: "true",
    };

    // Act / Assert: seed-only values cannot enable online payments.
    expect(() => validateEnvironment(configuration)).toThrow();
  });
});
