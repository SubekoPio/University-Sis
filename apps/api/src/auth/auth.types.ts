// Purpose: Define typed inputs and results for authentication services.
import type { PublicUser } from "../users/users.repository.js";

/** Credentials supplied to account registration. */
export interface RegisterInput {
  email: string;
  password: string;
}

/** Credentials supplied to login. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Optional client metadata stored with a refresh-token session. */
export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
}

/** Public account fields returned by authentication methods. */
export type AuthUser = Pick<PublicUser, "id" | "email" | "status" | "emailVerified">;

/** Access and refresh tokens returned after successful authentication. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

/** Successful authentication result with a safe user summary. */
export interface AuthResult extends AuthTokens {
  user: AuthUser;
}

/** Safe registration result that never includes credential material. */
export type RegistrationResult = Pick<
  PublicUser,
  "id" | "email" | "status" | "emailVerified" | "createdAt"
>;
