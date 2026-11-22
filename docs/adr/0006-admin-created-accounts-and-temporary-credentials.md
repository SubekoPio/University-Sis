<!-- Purpose: Record the decision to provision accounts administratively and force temporary-password replacement. -->

# ADR 0006: Admin-Created Accounts with Temporary Credentials

- **Status:** Proposed
- **Date:** 2026-11-21

## Context

The institution does not permit public self-registration. Administrators
provision staff accounts, and students receive accounts only after admission.
The application needs an auditable way to deliver first-login credentials and
to prevent temporary credentials from becoming permanent passwords.

The implementation adds User lifecycle fields, an administrator user service,
permission-protected management routes, and authentication gates. The public
`POST /auth/register` route is absent.

## Decision

1. Do not expose public account sign-up. Administer account creation through
   `AdminUsersService`; student accounts follow admission.
2. Generate a cryptographically random temporary password, persist only its
   Argon2 hash, and send the plaintext only through the credential email.
3. Set `mustChangePassword` and an expiry (default seven days). A successful
   login with an unexpired temporary password must change it before using any
   other endpoint except logout.
4. Require the current temporary password, reject reuse, and clear temporary
   state after a successful change. Verify the email and revoke other sessions
   while preserving the session used for the change.
5. Deny login for expired credentials and require administrator credential
   reissue. Email delivery failure does not roll back the account; record the
   failure and permit a resend.
6. Require `admin:user:manage` for account-management HTTP routes and audit
   account creation, credential delivery, role changes, and lifecycle actions.

## Alternatives

- **Public registration:** rejected because users must be provisioned by
  administrators and students are admitted.
- **Permanent password chosen by an administrator:** rejected because the
  account holder must replace the initial secret.
- **Return or persist the temporary password in the API:** rejected because
  the password must not be stored or disclosed in API responses.
- **Fail account creation when email delivery fails:** rejected because the
  created account can be safely retained and credentials resent.

## Consequences

- Administrators must maintain a valid login URL and email-delivery
  configuration. Failed delivery is observable through audit outcomes.
- The user requires administrator assistance after the temporary credential
  expires.
- The web client probes refresh when the current login response omits
  `mustChangePassword`; this rotates a normal user's refresh session once.
- The source-of-truth docs must distinguish implemented lifecycle behavior
  from planned academic, finance, and admission models and permissions.
