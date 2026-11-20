// Purpose: Expose permission-protected HTTP endpoints for administrator user management.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { CurrentUser } from "../common/rbac/current-user.decorator.js";
import { Permissions } from "../common/rbac/rbac.decorators.js";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import type { AuthenticatedUser } from "../common/rbac/rbac.types.js";
import {
  AdminUsersService,
  type AdminUserCreationResult,
  type AdminUserPage,
} from "./admin-users.service.js";
import type { AdminManagedUser } from "./admin-users.repository.js";
import { AdminUserIdParamDto } from "./dto/admin-user-id-param.dto.js";
import { CreateAdminUserRequestDto } from "./dto/create-admin-user.dto.js";
import { ListAdminUsersQueryDto } from "./dto/list-admin-users-query.dto.js";
import { UpdateAdminUserRolesDto } from "./dto/update-admin-user-roles.dto.js";
import { UserLifecycleReasonDto } from "./dto/user-lifecycle-reason.dto.js";

/** Maps protected administrator user routes to AdminUsersService operations. */
@ApiTags("Admin users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("admin:user:manage")
@Controller("admin/users")
export class AdminUsersController {
  /** Creates the HTTP adapter for administrator user-management operations. */
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /** Creates an account and queues its temporary credentials through the service. */
  @Post()
  @ApiOperation({ summary: "Create an administrator-managed user account" })
  @ApiBody({ type: CreateAdminUserRequestDto })
  @ApiCreatedResponse({
    description: "Account created; includes credential-email status.",
  })
  @ApiBadRequestResponse({
    description: "The request or one of its role IDs is invalid.",
  })
  @ApiForbiddenResponse({
    description: "The caller lacks the required permission.",
  })
  @ApiConflictResponse({
    description: "An account with the email already exists.",
  })
  @ApiUnauthorizedResponse({ description: "A valid access token is required." })
  createUser(
    @Body() input: CreateAdminUserRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUserCreationResult> {
    return this.adminUsersService.createUser(input, user.id);
  }

  /** Lists user accounts using validated search, role, status, and pagination filters. */
  @Get()
  @ApiOperation({ summary: "List and filter user accounts" })
  @ApiQuery({ type: ListAdminUsersQueryDto })
  @ApiOkResponse({ description: "A paginated list of safe user records." })
  @ApiBadRequestResponse({
    description: "A filter or pagination value is invalid.",
  })
  @ApiForbiddenResponse({
    description: "The caller lacks the required permission.",
  })
  @ApiUnauthorizedResponse({ description: "A valid access token is required." })
  listUsers(
    @Query() filters: ListAdminUsersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUserPage> {
    return this.adminUsersService.listUsers(filters, user.id);
  }

  /** Resends temporary credentials with a per-client rate limit. */
  @Post(":id/resend-credentials")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Resend temporary credentials for a user" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ description: "Credential delivery outcome." })
  @ApiBadRequestResponse({
    description: "Credentials cannot be resent for this account.",
  })
  @ApiForbiddenResponse({
    description: "The caller lacks the required permission.",
  })
  @ApiNotFoundResponse({ description: "The user account does not exist." })
  @ApiConflictResponse({
    description: "The account changed during credential rotation.",
  })
  @ApiTooManyRequestsResponse({
    description: "The resend rate limit was exceeded.",
  })
  @ApiUnauthorizedResponse({ description: "A valid access token is required." })
  resendCredentials(
    @Param() params: AdminUserIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ credentialsEmailSent: boolean }> {
    return this.adminUsersService.resendCredentials(params.id, user.id);
  }

  /** Replaces a user's role assignments through the service. */
  @Patch(":id/roles")
  @ApiOperation({ summary: "Replace role assignments for a user account" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ type: UpdateAdminUserRolesDto })
  @ApiOkResponse({ description: "The updated safe user record." })
  @ApiBadRequestResponse({
    description: "A role ID is invalid or does not exist.",
  })
  @ApiForbiddenResponse({
    description: "The caller lacks permission or a second approval is required.",
  })
  @ApiNotFoundResponse({ description: "The user account does not exist." })
  @ApiConflictResponse({
    description: "The role update could not be completed.",
  })
  @ApiUnauthorizedResponse({ description: "A valid access token is required." })
  updateRoles(
    @Param() params: AdminUserIdParamDto,
    @Body() input: UpdateAdminUserRolesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminManagedUser> {
    return this.adminUsersService.updateRoles(params.id, input.roleIds, user.id);
  }

  /** Deactivates a user account with the required reason. */
  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Deactivate a user account" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ type: UserLifecycleReasonDto })
  @ApiOkResponse({ description: "The deactivated safe user record." })
  @ApiBadRequestResponse({
    description: "The reason or account state is invalid.",
  })
  @ApiForbiddenResponse({
    description: "The caller lacks permission or cannot deactivate itself.",
  })
  @ApiNotFoundResponse({ description: "The user account does not exist." })
  @ApiConflictResponse({
    description: "The account is already deactivated or changed concurrently.",
  })
  @ApiUnauthorizedResponse({ description: "A valid access token is required." })
  deactivateUser(
    @Param() params: AdminUserIdParamDto,
    @Body() input: UserLifecycleReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminManagedUser> {
    return this.adminUsersService.deactivateUser(params.id, user.id, input.reason);
  }

  /** Reactivates a deactivated user account with the required reason. */
  @Post(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reactivate a deactivated user account" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ type: UserLifecycleReasonDto })
  @ApiOkResponse({ description: "The reactivated safe user record." })
  @ApiBadRequestResponse({
    description: "The reason or account state is invalid.",
  })
  @ApiForbiddenResponse({
    description: "The caller lacks the required permission.",
  })
  @ApiNotFoundResponse({ description: "The user account does not exist." })
  @ApiConflictResponse({
    description: "The account is not deactivated or changed concurrently.",
  })
  @ApiUnauthorizedResponse({ description: "A valid access token is required." })
  reactivateUser(
    @Param() params: AdminUserIdParamDto,
    @Body() input: UserLifecycleReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminManagedUser> {
    return this.adminUsersService.reactivateUser(params.id, user.id, input.reason);
  }
}
