// Purpose: Register authentication services and their dependencies.
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { RbacCoreModule } from "../common/rbac/rbac-core.module.js";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { MustChangePasswordGuard } from "../common/rbac/must-change-password.guard.js";
import { PrismaModule } from "../database/prisma.module.js";
import { UsersModule } from "../users/users.module.js";
import { getAccessTokenSecret } from "./auth.config.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { EmailModule } from "./email/email.module.js";
import { PasswordRecoveryRepository } from "./password-recovery.repository.js";
import { PasswordRecoveryService } from "./password-recovery.service.js";

/** Provides authentication services and HTTP endpoints. */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RbacCoreModule,
    EmailModule,
    UsersModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getAccessTokenSecret(config),
        signOptions: { algorithm: "HS256" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    PasswordRecoveryRepository,
    PasswordRecoveryService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
