// Purpose: Register reusable RBAC guards, data services, and Redis caching.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../../auth/auth.module.js";
import { PrismaModule } from "../../database/prisma.module.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { PermissionsGuard } from "./permissions.guard.js";
import { RbacRedisCacheService } from "./redis-cache.service.js";
import { RbacRepository } from "./rbac.repository.js";
import { RbacService } from "./rbac.service.js";
import { RolesGuard } from "./roles.guard.js";

/** Provides opt-in authentication and authorization infrastructure. */
@Module({
  imports: [AuthModule, ConfigModule, PrismaModule],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    RbacRedisCacheService,
    RbacRepository,
    RbacService,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, PermissionsGuard, RbacService, RolesGuard],
})
export class RbacModule {}
