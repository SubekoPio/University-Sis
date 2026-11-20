// Purpose: Validate and document administrator user-list filters.
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { UserStatus } from "@prisma/client";
import type { ListAdminUsersFilters } from "../admin-users.service.js";

/** Query parameters for GET /admin/users. */
export class ListAdminUsersQueryDto implements ListAdminUsersFilters {
  /** Case-insensitive email or name search. */
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Filter by assigned role name. */
  @ApiPropertyOptional({ example: "lecturer", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  /** Filter by account lifecycle status. */
  @ApiPropertyOptional({ enum: UserStatus, enumName: "UserStatus" })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** One-based result page; defaults to the service's first page. */
  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Number of rows per page, capped at 100. */
  @ApiPropertyOptional({ maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
