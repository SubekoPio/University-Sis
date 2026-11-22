// Purpose: Test API-key and HMAC authentication for the website admissions integration.
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { WebsiteIntegrationGuard } from "./website-integration.guard.js";

const SECRET = "a-secure-website-integration-secret-with-at-least-32-bytes";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

function createContext(headers: Record<string, string>, rawBody?: Buffer): ExecutionContext {
  const request = {
    header: (name: string) => headers[name.toLowerCase()],
    rawBody,
  } as RequestWithRawBody;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("WebsiteIntegrationGuard", () => {
  const guard = new WebsiteIntegrationGuard(
    new ConfigService({ WEBSITE_INTEGRATION_SECRET: SECRET }),
  );

  it("accepts a matching API key", () => {
    // Arrange: provide the configured secret in the API-key header.
    const context = createContext({ "x-api-key": SECRET });

    // Act / Assert: allow the secured integration request.
    expect(guard.canActivate(context)).toBe(true);
  });

  it("accepts an HMAC signature over the exact request bytes", () => {
    // Arrange: sign the exact serialized request body with the integration secret.
    const rawBody = Buffer.from('{"externalRef":"website-123"}', "utf8");
    const signature = createHmac("sha256", SECRET).update(rawBody).digest("hex");

    // Act / Assert: accept the correctly signed raw request.
    expect(
      guard.canActivate(createContext({ "x-signature": `sha256=${signature}` }, rawBody)),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    // Arrange: the supplied digest does not match the request bytes.
    const rawBody = Buffer.from('{"externalRef":"website-123"}', "utf8");

    // Act / Assert: invalid integration credentials fail closed.
    expect(() =>
      guard.canActivate(createContext({ "x-signature": `sha256=${"0".repeat(64)}` }, rawBody)),
    ).toThrow(UnauthorizedException);
  });
});
