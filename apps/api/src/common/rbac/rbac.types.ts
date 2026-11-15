// Purpose: Define the authenticated request and authorization snapshot shapes.
import type { Request } from "express";

/** Identity established by a verified access token. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Roles and permission keys resolved for one account. */
export interface AuthorizationSnapshot {
  roles: string[];
  permissions: string[];
}

/** Express request shape after JwtAuthGuard establishes the user identity. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/** Signed access-token claims required by JwtAuthGuard. */
export interface AccessTokenClaims {
  sub: string;
  sid: string;
  email: string;
  exp: number;
}
