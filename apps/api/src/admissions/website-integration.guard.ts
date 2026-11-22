// Purpose: Authenticate website application intake using an API key or HMAC.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/** Authenticates the website integration using its shared secret. */
@Injectable()
export class WebsiteIntegrationGuard implements CanActivate {
  /** Receives the validated integration secret. */
  constructor(private readonly config: ConfigService) {}

  /** Accepts a constant-time API-key match or a SHA-256 signature of the exact request bytes. */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest>();
    const secret = this.config.getOrThrow<string>("WEBSITE_INTEGRATION_SECRET");
    const apiKey = request.header("x-api-key");
    if (apiKey !== undefined && this.constantTimeEqual(apiKey, secret)) {
      return true;
    }

    const signature = request.header("x-signature");
    if (signature !== undefined && request.rawBody !== undefined) {
      const match = /^sha256=([a-f0-9]{64})$/i.exec(signature);
      if (match !== null) {
        const expected = createHmac("sha256", secret).update(request.rawBody).digest();
        const received = Buffer.from(match[1], "hex");
        if (received.length === expected.length && timingSafeEqual(received, expected)) {
          return true;
        }
      }
    }

    throw new UnauthorizedException("A valid website integration credential is required.");
  }

  private constantTimeEqual(candidate: string, expected: string): boolean {
    const candidateBytes = Buffer.from(candidate, "utf8");
    const expectedBytes = Buffer.from(expected, "utf8");
    return (
      candidateBytes.length === expectedBytes.length &&
      timingSafeEqual(candidateBytes, expectedBytes)
    );
  }
}
