// Purpose: Validate and document required account lifecycle reasons.
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/** Request body for deactivation and reactivation actions. */
export class UserLifecycleReasonDto {
  /** Required reason recorded with the lifecycle action. */
  @ApiProperty({ example: "Staff member left the institution." })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
