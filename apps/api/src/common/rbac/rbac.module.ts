// Purpose: Register reusable RBAC guards, data services, and Redis caching.
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { getAccessTokenSecret } from "../../auth/auth.config.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { PermissionsGuard } from "./permissions.guard.js";
import { RbacCoreModule } from "./rbac-core.module.js";
import { RolesGuard } from "./roles.guard.js";

/** Provides opt-in authentication and authorization infrastructure. */
@Module({
  imports: [
    ConfigModule,
    RbacCoreModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getAccessTokenSecret(config),
        signOptions: { algorithm: "HS256" },
      }),
    }),
  ],
  providers: [JwtAuthGuard, PermissionsGuard, RolesGuard],
  exports: [JwtAuthGuard, PermissionsGuard, RbacCoreModule, RolesGuard, JwtModule],
})
export class RbacModule {}
