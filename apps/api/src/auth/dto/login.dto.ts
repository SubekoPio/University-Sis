// Purpose: Validate the login request body before it reaches authentication services.
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";
import type { LoginInput } from "../auth.types.js";

/** Request body for POST /auth/login. */
export class LoginDto implements LoginInput {
  /** Normalized by AuthService after validation. */
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Plaintext login password; never returned or logged. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}
