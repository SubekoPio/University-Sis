// Purpose: Validate the account registration request body.
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";
import type { RegisterInput } from "../auth.types.js";

/** Request body for POST /auth/register. */
export class RegisterDto implements RegisterInput {
  /** Account email address. */
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Account password; the service hashes it before persistence. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
