// Purpose: Register user persistence and application services.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EmailModule } from "../auth/email/email.module.js";
import { PasswordHashingService } from "../auth/password-hashing.service.js";
import { RbacCoreModule } from "../common/rbac/rbac-core.module.js";
import { PrismaModule } from "../database/prisma.module.js";
import { AdminUsersRepository } from "./admin-users.repository.js";
import { AdminUsersService } from "./admin-users.service.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";

/** Provides user services to authentication and other API modules. */
@Module({
  imports: [ConfigModule, EmailModule, PrismaModule, RbacCoreModule],
  providers: [
    AdminUsersRepository,
    AdminUsersService,
    PasswordHashingService,
    UsersRepository,
    UsersService,
  ],
  exports: [AdminUsersService, PasswordHashingService, UsersService],
})
export class UsersModule {}
