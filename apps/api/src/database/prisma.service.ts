// Purpose: Manage the Prisma client's NestJS application lifecycle.
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** Connects and disconnects the shared Prisma client with the application. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Opens the database connection when Nest starts. */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Closes the database connection during application shutdown. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
