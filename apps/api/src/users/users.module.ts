// Purpose: Register user persistence and application services.
import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";

/** Provides user services to authentication and other API modules. */
@Module({
  imports: [PrismaModule],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
