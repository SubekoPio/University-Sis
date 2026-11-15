// Purpose: Resolve and cache effective RBAC data for authenticated users.
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RbacRedisCacheService } from "./redis-cache.service.js";
import { RbacRepository } from "./rbac.repository.js";
import type { AuthorizationSnapshot } from "./rbac.types.js";

const DEFAULT_CACHE_TTL_SECONDS = 60;

/** Resolves user roles and permissions, using Redis as a bounded cache. */
@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly cacheTtlSeconds: number;

  /**
   *
   */
  constructor(
    private readonly repository: RbacRepository,
    private readonly cache: RbacRedisCacheService,
    config: ConfigService,
  ) {
    const configuredTtl = config.get<string>("RBAC_CACHE_TTL_SECONDS");
    this.cacheTtlSeconds =
      configuredTtl === undefined || configuredTtl.trim().length === 0
        ? DEFAULT_CACHE_TTL_SECONDS
        : Number(configuredTtl);

    if (!Number.isSafeInteger(this.cacheTtlSeconds) || this.cacheTtlSeconds <= 0) {
      throw new Error("RBAC_CACHE_TTL_SECONDS must be a positive integer number of seconds.");
    }
  }

  /** Returns a user's current roles and granted permission keys. */
  async getAuthorizationSnapshot(userId: string): Promise<AuthorizationSnapshot> {
    const cacheKey = this.cacheKey(userId);
    const cachedValue = await this.cache.get(cacheKey);
    if (cachedValue !== null) {
      const cachedSnapshot = this.parseCachedSnapshot(cachedValue);
      if (cachedSnapshot !== null) {
        return cachedSnapshot;
      }

      await this.cache.delete(cacheKey);
    }

    const snapshot = await this.repository.getAuthorizationSnapshot(userId);
    await this.cache.set(cacheKey, JSON.stringify(snapshot), this.cacheTtlSeconds);
    return snapshot;
  }

  /** Checks whether a signed access token refers to a live, unrevoked session. */
  isActiveSession(userId: string, sessionId: string): Promise<boolean> {
    return this.repository.isActiveSession(userId, sessionId, new Date());
  }

  private cacheKey(userId: string): string {
    return `sis:rbac:user:${userId}`;
  }

  private parseCachedSnapshot(value: string): AuthorizationSnapshot | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (error: unknown) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }

      this.logger.warn("Discarding malformed RBAC cache entry.");
      return null;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("roles" in parsed) ||
      !("permissions" in parsed) ||
      !this.isStringArray(parsed.roles) ||
      !this.isStringArray(parsed.permissions)
    ) {
      this.logger.warn("Discarding malformed RBAC cache entry.");
      return null;
    }

    return {
      roles: parsed.roles,
      permissions: parsed.permissions,
    };
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
  }
}
