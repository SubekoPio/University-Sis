// Purpose: Provide Redis-backed cache operations for RBAC authorization data.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";

/** Manages the Redis client used by RBAC permission caching. */
@Injectable()
export class RbacRedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RbacRedisCacheService.name);
  private readonly client: ReturnType<typeof createClient>;

  /**
   *
   */
  constructor(config: ConfigService) {
    const configuredUrl = config.get<string>("REDIS_URL")?.trim();
    const portValue = config.get<string>("REDIS_PORT") ?? "6379";
    const port = Number(portValue);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error("REDIS_PORT must be an integer between 1 and 65535.");
    }

    const host = config.get<string>("REDIS_HOST")?.trim() || "127.0.0.1";
    const url = configuredUrl || `redis://${host}:${port}`;
    this.client = createClient({
      url,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: (retries) =>
          retries >= 5
            ? new Error("Redis connection retry limit reached.")
            : Math.min(retries * 200, 1_000),
      },
    });
    this.client.on("error", (error: Error) => {
      this.logger.error("Redis client error.", error);
    });
  }

  /** Connects to Redis before the API starts serving requests. */
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  /** Closes the Redis connection during application shutdown. */
  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  /** Reads a cached string, returning null when the key is absent. */
  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Stores a cache entry with a bounded lifetime. */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  /** Deletes one cache entry. */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
