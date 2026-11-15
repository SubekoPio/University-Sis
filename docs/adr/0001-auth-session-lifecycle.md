# ADR 0001: Use Rotating Opaque Refresh Sessions

- **Status:** Proposed
- **Date:** 2026-11-15

## Context

Authentication needs short-lived access credentials and a server-revocable
session lifecycle. Storing raw refresh credentials would expose reusable bearer
secrets in the database, while stateless refresh JWTs would make rotation,
logout, and reuse response harder to enforce.

## Decision

Use Argon2id for password hashes, HS256 access JWTs with a 15-minute default
expiry, and 32-byte opaque refresh tokens with a 30-day default lifetime.
Persist only the SHA-256 digest of each refresh token. Rotate refresh sessions
transactionally; if a revoked refresh token is reused, revoke the user's
remaining sessions. Check the backing session and active account when a JWT is
used by `JwtAuthGuard`.

The implementation reads the signing secret from `JWT_ACCESS_SECRET` and
rejects absent or too-short secrets.

## Alternatives

- **Long-lived stateless access/refresh JWTs:** rejected because individual
  sessions could not be revoked or rotated reliably.
- **Store raw refresh tokens:** rejected because a database read would expose
  credentials that can be replayed.
- **Hash access and refresh JWTs alike:** not selected; access JWTs are verified
  cryptographically, while the opaque refresh value is looked up by digest.

## Consequences

- Refresh rotation, logout, reuse detection, and password-reset revocation can
  invalidate sessions server-side.
- Authenticated requests require a live session lookup, so the database is on
  the authorization path.
- Token lifetime and signing-secret configuration are operational
  requirements; token cleanup/retention is not yet implemented.
- Refresh-token hashes use a fast digest because the refresh token has
  cryptographic randomness; passwords continue to use Argon2id.

The current implementation is in `apps/api/src/auth/` and
`apps/api/src/common/rbac/jwt-auth.guard.ts`.
