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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
