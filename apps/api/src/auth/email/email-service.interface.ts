// Purpose: Define the transport-neutral email contract for auth workflows.

/** Message content supported by authentication email notifications. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Sends an email without exposing a specific provider to auth services. */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

/** Injection token for the configured EmailService implementation. */
export const EMAIL_SERVICE = Symbol("EMAIL_SERVICE");
