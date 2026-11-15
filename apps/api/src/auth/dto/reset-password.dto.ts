// Purpose: Validate password-reset tokens and the replacement password.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** Request body for POST /auth/reset-password. */
export class ResetPasswordDto {
  /** One-time password reset token delivered by email. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  /** Replacement password; the service hashes it before persistence. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
