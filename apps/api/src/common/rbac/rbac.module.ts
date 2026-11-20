// Purpose: Register reusable RBAC guards, data services, and Redis caching.
import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { PermissionsGuard } from "./permissions.guard.js";
import { RbacCoreModule } from "./rbac-core.module.js";
import { RolesGuard } from "./roles.guard.js";

/** Provides opt-in authentication and authorization infrastructure. */
@Module({
  imports: [AuthModule, RbacCoreModule],
  providers: [JwtAuthGuard, PermissionsGuard, RolesGuard],
  exports: [JwtAuthGuard, PermissionsGuard, RbacCoreModule, RolesGuard],
})
export class RbacModule {}
