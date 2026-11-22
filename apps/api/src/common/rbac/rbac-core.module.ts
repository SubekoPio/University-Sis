// Purpose: Share RBAC persistence and cache services without importing HTTP authentication modules.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../database/prisma.module.js";
import { RbacRedisCacheService } from "./redis-cache.service.js";
import { RbacRepository } from "./rbac.repository.js";
import { RbacService } from "./rbac.service.js";

/** Provides reusable permission-resolution services to feature modules. */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RbacRedisCacheService, RbacRepository, RbacService],
  exports: [RbacRedisCacheService, RbacService],
})
export class RbacCoreModule {}
