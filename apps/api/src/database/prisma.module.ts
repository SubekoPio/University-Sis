// Purpose: Provide the shared Prisma client to API repositories.
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

/** Makes the Prisma client available to repository modules. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
