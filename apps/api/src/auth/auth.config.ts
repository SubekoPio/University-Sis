// Purpose: Read and validate authentication configuration from ConfigService.
import type { ConfigService } from "@nestjs/config";

/** Reads the required access-token signing secret and enforces a minimum size. */
export function getAccessTokenSecret(config: ConfigService): string {
  const secret = config.getOrThrow<string>("JWT_ACCESS_SECRET").trim();
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("JWT_ACCESS_SECRET must contain at least 32 bytes.");
  }

  return secret;
}

/** Reads a positive integer duration in seconds, using the supplied fallback. */
export function getDurationSeconds(config: ConfigService, key: string, fallback: number): number {
  const configured = config.get<string>(key);
  if (configured === undefined || configured.trim().length === 0) {
    return fallback;
  }

  const seconds = Number(configured);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`${key} must be a positive integer number of seconds.`);
  }

  return seconds;
}
