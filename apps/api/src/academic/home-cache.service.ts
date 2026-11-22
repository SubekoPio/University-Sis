// Purpose: Cache aggregated home responses and invalidate them after academic changes.
import { Injectable, Logger } from "@nestjs/common";
import { RbacRedisCacheService } from "../common/rbac/redis-cache.service.js";

const HOME_CACHE_TTL_SECONDS = 60;
const HOME_CACHE_KEY_PREFIX = "sis:home:v1:";

interface HomeCacheEnvelope {
  view: string;
  value: unknown;
}

/** Stores per-user home responses in Redis and removes malformed cache entries. */
@Injectable()
export class HomeCacheService {
  private readonly logger = new Logger(HomeCacheService.name);

  /** Receives the shared Redis cache client. */
  constructor(private readonly redis: RbacRedisCacheService) {}

  /** Reads and validates the cached payload for the requested home view. */
  async get<T>(
    userId: string,
    view: string,
    parse: (value: unknown) => T | null,
  ): Promise<T | null> {
    const key = this.cacheKey(userId);
    const raw = await this.redis.get(key);
    if (raw === null) {
      return null;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(raw) as unknown;
    } catch (error: unknown) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
      this.logger.warn("Discarding malformed home cache entry.");
      await this.redis.delete(key);
      return null;
    }
    if (!this.isEnvelope(decoded) || decoded.view !== view) {
      this.logger.warn("Discarding invalid or mismatched home cache entry.");
      await this.redis.delete(key);
      return null;
    }

    const value = parse(decoded.value);
    if (value === null) {
      this.logger.warn("Discarding malformed home cache payload.");
      await this.redis.delete(key);
      return null;
    }
    return value;
  }

  /** Stores an aggregated response with the required 60-second lifetime. */
  set(userId: string, view: string, value: unknown): Promise<void> {
    return this.redis.set(
      this.cacheKey(userId),
      JSON.stringify({ view, value }),
      HOME_CACHE_TTL_SECONDS,
    );
  }

  /** Invalidates all cached home data for a user after selection or attendance changes. */
  invalidateUser(userId: string): Promise<void> {
    return this.redis.delete(this.cacheKey(userId));
  }

  private cacheKey(userId: string): string {
    return `${HOME_CACHE_KEY_PREFIX}${userId}`;
  }

  private isEnvelope(value: unknown): value is HomeCacheEnvelope {
    return (
      typeof value === "object" &&
      value !== null &&
      "view" in value &&
      typeof value.view === "string" &&
      "value" in value
    );
  }
}
