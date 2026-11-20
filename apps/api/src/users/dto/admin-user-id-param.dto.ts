// Purpose: Validate and document the user ID route parameter.
import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

/** Route parameter for administrator operations on one user account. */
export class AdminUserIdParamDto {
  /** UUID of the account being managed. */
  @ApiProperty({ format: "uuid" })
  @IsUUID("all")
  id!: string;
}
