// Purpose: Expose the authenticated user to controller parameters.
import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest, AuthenticatedUser } from "./rbac.types.js";

/** Reads the identity established by JwtAuthGuard or rejects an unguarded request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === undefined) {
      throw new UnauthorizedException("Authentication is required.");
    }

    return request.user;
  },
);
