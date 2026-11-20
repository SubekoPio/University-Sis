// Purpose: Validate and document an administrator-created account request.
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import type { CreateAdminUserDto } from "../admin-users.service.js";

/** Request body for POST /admin/users. */
export class CreateAdminUserRequestDto implements CreateAdminUserDto {
  /** Login email for the new account. */
  @ApiProperty({
    format: "email",
    example: "staff@example.edu",
    maxLength: 320,
  })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Display name associated with the account. */
  @ApiProperty({ example: "Alex Morgan" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Existing role IDs to assign to the account. */
  @ApiProperty({ format: "uuid", isArray: true, type: String })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  roleIds!: string[];
}
