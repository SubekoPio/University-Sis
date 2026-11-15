// Purpose: Validate email-address request bodies for recovery workflows.
import { IsEmail, MaxLength } from "class-validator";

/** Request body for password-recovery and verification-resend operations. */
export class EmailAddressDto {
  /** Existing or newly registered account email. */
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
