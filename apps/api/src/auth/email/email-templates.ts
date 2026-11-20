// Purpose: Render simple HTML messages for password and email verification.

/** Renders the password-reset instructions for a one-time token. */
export function createPasswordResetEmail(token: string): string {
  const safeToken = escapeHtml(token);
  return [
    "<!doctype html>",
    "<html><body>",
    "<h1>Reset your password</h1>",
    "<p>Use this one-time token to reset your password:</p>",
    `<p><code>${safeToken}</code></p>`,
    "<p>This token expires in one hour. Ignore this message if you did not request it.</p>",
    "</body></html>",
  ].join("");
}

/** Renders the email-verification instructions for a one-time token. */
export function createEmailVerificationEmail(token: string): string {
  const safeToken = escapeHtml(token);
  return [
    "<!doctype html>",
    "<html><body>",
    "<h1>Verify your email address</h1>",
    "<p>Use this one-time token to verify your email address:</p>",
    `<p><code>${safeToken}</code></p>`,
    "<p>This token expires in 24 hours.</p>",
    "</body></html>",
  ].join("");
}

/** Renders a one-time credential email for an administrator-provisioned account. */
export function createTemporaryCredentialsEmail(input: {
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresAt: Date | null;
}): string {
  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safePassword = escapeHtml(input.temporaryPassword);
  const safeLoginUrl = escapeHtml(input.loginUrl);
  const expiryText =
    input.expiresAt === null
      ? ""
      : `<p>This temporary password expires at ${escapeHtml(input.expiresAt.toISOString())}.</p>`;

  return [
    "<!doctype html>",
    "<html><body>",
    `<p>Hello ${safeName},</p>`,
    "<p>An administrator created your University SIS account.</p>",
    `<p>Sign in at <a href="${safeLoginUrl}">${safeLoginUrl}</a>.</p>`,
    `<p>Email: <code>${safeEmail}</code></p>`,
    `<p>Temporary password: <code>${safePassword}</code></p>`,
    "<p>You must choose a new password after signing in.</p>",
    expiryText,
    "</body></html>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
