// Purpose: Verify bearer access tokens and establish the request user identity.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedRequest, AccessTokenClaims } from "./rbac.types.js";
import { RbacService } from "./rbac.service.js";

const jwtValidationErrorNames = new Set([
  "JsonWebTokenError",
  "NotBeforeError",
  "TokenExpiredError",
]);

/** Requires a valid access JWT backed by a live, unrevoked session. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  /**
   *
   */
  constructor(
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
  ) {}

  /** Verifies bearer credentials and populates request.user on success. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === "string" ? /^Bearer\s+([^\s]+)$/i.exec(authorization.trim()) : null;
    const token = match?.[1];
    if (token === undefined) {
      throw new UnauthorizedException("A bearer access token is required.");
    }

    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ["HS256"],
      });
    } catch (error: unknown) {
      if (error instanceof Error && jwtValidationErrorNames.has(error.name)) {
        throw new UnauthorizedException("Invalid or expired access token.");
      }

      throw error;
    }

    if (!this.isAccessTokenClaims(payload)) {
      throw new UnauthorizedException("Invalid access-token claims.");
    }

    if (!(await this.rbacService.isActiveSession(payload.sub, payload.sid))) {
      throw new UnauthorizedException("The access-token session is inactive.");
    }

    request.user = { id: payload.sub, email: payload.email };
    return true;
  }

  private isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
    return (
      typeof value === "object" &&
      value !== null &&
      "sub" in value &&
      typeof value.sub === "string" &&
      value.sub.length > 0 &&
      "sid" in value &&
      typeof value.sid === "string" &&
      value.sid.length > 0 &&
      "email" in value &&
      typeof value.email === "string" &&
      "exp" in value &&
      typeof value.exp === "number" &&
      value.exp > Math.floor(Date.now() / 1_000)
    );
  }
}
