// Purpose: Register the HTTP adapter for administrator-managed user accounts.
import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { RbacModule } from "../common/rbac/rbac.module.js";
import { UsersModule } from "./users.module.js";
import { AdminUsersController } from "./admin-users.controller.js";

/** Provides permission-guarded administrator user-management endpoints. */
@Module({
  imports: [UsersModule, RbacModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [AdminUsersController],
})
export class AdminUsersHttpModule {}
