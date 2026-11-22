// Purpose: Validate meeting links against the configured HTTPS host allow-list.
import { BadRequestException } from "@nestjs/common";
import { isUUID } from "class-validator";

/** Rejects invalid UUIDs before academic identifiers reach Prisma. */
export function validateAcademicUuid(value: string, label: string): string {
  if (typeof value !== "string" || !isUUID(value)) {
    throw new BadRequestException(`${label} must be a valid UUID.`);
  }
  return value;
}

/** Validates an optional meeting link against exact configured host names. */
export function validateMeetingUrl(
  value: string | null | undefined,
  allowedHosts: readonly string[],
): string | null {
  if (value === undefined || value === null || value.trim().length === 0) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      throw new BadRequestException("Meeting link must be a valid HTTPS URL.");
    }
    throw error;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = allowedHosts.some((host) => hostname === host.toLowerCase().replace(/\.$/, ""));
  if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0 || !allowed) {
    throw new BadRequestException(
      "Meeting link must use HTTPS and a host permitted by the meeting configuration.",
    );
  }

  return url.toString();
}
