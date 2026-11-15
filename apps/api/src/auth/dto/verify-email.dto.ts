// Purpose: Validate the one-time email-verification request token.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** Request body for POST /auth/verify-email. */
export class VerifyEmailDto {
  /** One-time verification token delivered by email. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
