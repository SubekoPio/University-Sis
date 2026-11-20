// Purpose: Validate the current and replacement passwords for a forced password change.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** Request body for POST /auth/change-password. */
export class ChangePasswordDto {
  /** Temporary password currently associated with the authenticated account. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  currentPassword!: string;

  /** Replacement password; uses the existing non-empty, 1024-character policy. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  newPassword!: string;
}
