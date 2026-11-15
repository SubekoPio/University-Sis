// Purpose: Enforce explicitly declared permission requirements.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_METADATA_KEY } from "./rbac.decorators.js";
import type { AuthenticatedRequest } from "./rbac.types.js";
import { RbacService } from "./rbac.service.js";

/** Allows a request only when all required permissions are granted by its roles. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  /**
   *
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  /** Resolves effective permissions and denies missing or unsatisfied metadata. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (
      requiredPermissions === undefined ||
      requiredPermissions.length === 0 ||
      request.user === undefined
    ) {
      throw new ForbiddenException("An explicit permission requirement is required.");
    }

    const authorization = await this.rbacService.getAuthorizationSnapshot(request.user.id);
    if (
      !requiredPermissions.every((permission) => authorization.permissions.includes(permission))
    ) {
      throw new ForbiddenException("The user does not have all required permissions.");
    }

    return true;
  }
}
