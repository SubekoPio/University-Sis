// Purpose: Enforce explicitly declared role requirements.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_METADATA_KEY } from "./rbac.decorators.js";
import type { AuthenticatedRequest } from "./rbac.types.js";
import { RbacService } from "./rbac.service.js";

/** Allows a request only when its authenticated user has a required role. */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   *
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  /** Checks role metadata and denies requests with missing requirements. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (requiredRoles === undefined || requiredRoles.length === 0 || request.user === undefined) {
      throw new ForbiddenException("An explicit role requirement is required.");
    }

    const authorization = await this.rbacService.getAuthorizationSnapshot(request.user.id);
    if (!requiredRoles.some((role) => authorization.roles.includes(role))) {
      throw new ForbiddenException("The user does not have a required role.");
    }

    return true;
  }
}
