// Purpose: Validate and document a user's replacement role assignments.
import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsUUID } from "class-validator";

/** Request body for PATCH /admin/users/:id/roles. */
export class UpdateAdminUserRolesDto {
  /** Desired role IDs; an empty list removes all roles subject to service safeguards. */
  @ApiProperty({ format: "uuid", isArray: true, type: String })
  @IsArray()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  roleIds!: string[];
}
