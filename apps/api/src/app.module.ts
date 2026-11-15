import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { RbacModule } from "./common/rbac/rbac.module.js";

/** Registers the root NestJS module for the application. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The API may be started from its workspace directory or repository root.
      envFilePath: [".env", "../../.env"],
    }),
    AuthModule,
    RbacModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
