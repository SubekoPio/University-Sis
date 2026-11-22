// Purpose: Validate and type the API environment before application startup.
import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const integerFromEnvironment = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
}, z.number().int().max(Number.MAX_SAFE_INTEGER));
const nonNegativeInteger = integerFromEnvironment;
const percent = integerFromEnvironment.pipe(z.number().min(0).max(100));
const positiveInteger = integerFromEnvironment.pipe(z.number().positive());
const disabledSeedFlag = z
  .literal("false")
  .default("false")
  .transform(() => false);
const hostname = z
  .string()
  .max(253)
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i,
  );

/**
 * Describes required application settings, safe defaults, and seed-only flags.
 * Passthrough preserves existing variables not owned by this schema.
 */
export const environmentSchema = z
  .object({
    APP_URL: z
      .string()
      .url()
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
        message: "APP_URL must use http or https.",
      }),
    EMAIL_FROM: nonEmptyString,
    RESEND_API_KEY: z.string().default(""),
    EMAIL_PROVIDER: z.string().optional(),
    TEMP_PASSWORD_TTL_DAYS: positiveInteger.default(7),
    WEBSITE_INTEGRATION_SECRET: z
      .string()
      .trim()
      .refine((value) => Buffer.byteLength(value, "utf8") >= 32, {
        message: "WEBSITE_INTEGRATION_SECRET must contain at least 32 bytes.",
      }),
    MEETING_ALLOWED_HOSTS: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.split(",").map((host) => host.trim().toLowerCase()))
      .pipe(z.array(hostname).min(1)),
    MINIO_ENDPOINT: z
      .string()
      .url()
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
        message: "MINIO_ENDPOINT must use http or https.",
      })
      .default("http://127.0.0.1:9000"),
    MINIO_REGION: nonEmptyString.default("us-east-1"),
    MINIO_ROOT_USER: nonEmptyString,
    MINIO_ROOT_PASSWORD: nonEmptyString,
    MINIO_BUCKET: nonEmptyString.default("school-files"),
    ATTENDANCE_MIN_CONTINUOUS_PERCENT: percent.default(75),
    ATTENDANCE_RECONNECT_GRACE_SECONDS: nonNegativeInteger.default(180),
    ATTENDANCE_WARNING_PERCENT: percent.default(75),
    APPLICATION_FEE_AMOUNT_MINOR: nonNegativeInteger,
    CURRENCY: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, {
        message: "CURRENCY must be a three-letter uppercase currency code.",
      }),
    SCHOOL_NAME: nonEmptyString,
    SCHOOL_LOGO_KEY: nonEmptyString,
    FEATURE_ONLINE_CARD_ENABLED: disabledSeedFlag,
    FEATURE_ONLINE_BANK_ENABLED: disabledSeedFlag,
    FEATURE_ONLINE_MOBILE_ENABLED: disabledSeedFlag,
  })
  .passthrough()
  .superRefine((environment, context) => {
    // Preserve the existing default provider while failing before startup if its key is missing.
    const emailProvider = environment.EMAIL_PROVIDER?.trim().toLowerCase() ?? "resend";
    if (emailProvider === "resend" && environment.RESEND_API_KEY.trim().length === 0) {
      context.addIssue({
        code: "custom",
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER is resend.",
        path: ["RESEND_API_KEY"],
      });
    }
  });

/** Type of the validated API environment, including defaults and parsed hosts. */
export type EnvironmentConfig = z.infer<typeof environmentSchema>;

/** Validates environment variables and preserves unrelated existing settings. */
export function validateEnvironment(configuration: Record<string, unknown>): EnvironmentConfig {
  return environmentSchema.parse(configuration);
}
