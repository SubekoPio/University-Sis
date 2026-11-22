import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AcademicModule } from "./academic/academic.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { RbacModule } from "./common/rbac/rbac.module.js";
import { validateEnvironment } from "./config/environment.config.js";
import { AdminUsersHttpModule } from "./users/admin-users-http.module.js";

/** Registers the root NestJS module for the application. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The API may be started from its workspace directory or repository root.
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment,
    }),
    AcademicModule,
    AuthModule,
    RbacModule,
    AdminUsersHttpModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
