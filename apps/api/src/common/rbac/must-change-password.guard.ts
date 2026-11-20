// Purpose: Restrict authenticated temporary-password sessions to password change and logout.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { RbacService } from "./rbac.service.js";
import type { AccessTokenClaims } from "./rbac.types.js";
import { UsersService } from "../../users/users.service.js";

const jwtValidationErrorNames = new Set([
  "JsonWebTokenError",
  "NotBeforeError",
  "TokenExpiredError",
]);

/** Applies the forced-password-change route restriction to every request with a bearer session. */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  /**
   *
   */
  constructor(
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
    private readonly usersService: UsersService,
  ) {}

  /** Blocks a temporary-password session from every route except change-password and logout. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    // Keep public routes usable without a token; protected routes authenticate in JwtAuthGuard.
    if (authorization === undefined || typeof authorization !== "string") {
      return true;
    }

    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
    const token = match?.[1];
    if (token === undefined) {
      return true;
    }

    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ["HS256"],
      });
    } catch (error: unknown) {
      if (error instanceof Error && jwtValidationErrorNames.has(error.name)) {
        return true;
      }

      throw error;
    }

    if (!this.isAccessTokenClaims(payload)) {
      return true;
    }
    if (!(await this.rbacService.isActiveSession(payload.sub, payload.sid))) {
      return true;
    }

    const user = await this.usersService.findForAuthenticationById(payload.sub);
    if (user === null || !user.mustChangePassword || this.isAllowedRoute(request)) {
      return true;
    }

    const expired =
      user.temporaryPasswordExpiresAt === null || user.temporaryPasswordExpiresAt <= new Date();
    throw new ForbiddenException({
      code: "MUST_CHANGE_PASSWORD",
      message: expired
        ? "Your temporary password has expired. Contact an administrator."
        : "Change your temporary password before accessing this endpoint.",
    });
  }

  private isAllowedRoute(request: Request): boolean {
    const path = request.path.replace(/\/+$/, "");
    return (
      request.method === "POST" && (path === "/auth/change-password" || path === "/auth/logout")
    );
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
