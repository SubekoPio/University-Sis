// Purpose: Test home-cache TTL, per-user keys, and explicit invalidation.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacRedisCacheService } from "../common/rbac/redis-cache.service.js";
import { HomeCacheService } from "./home-cache.service.js";

const USER_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const redisMock = {
  delete: vi.fn<RbacRedisCacheService["delete"]>(),
  get: vi.fn<RbacRedisCacheService["get"]>(),
  set: vi.fn<RbacRedisCacheService["set"]>(),
};

describe("HomeCacheService", () => {
  let service: HomeCacheService;

  beforeEach(() => {
    vi.resetAllMocks();
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue();
    redisMock.delete.mockResolvedValue();
    service = new HomeCacheService(redisMock as unknown as RbacRedisCacheService);
  });

  it("stores each view under a user key with a 60-second expiration", async () => {
    // Arrange: use a small response payload that can be serialized to Redis.
    const payload = { userId: USER_ID };

    // Act: cache the student home response.
    await service.set(USER_ID, "student", payload);

    // Assert: use the per-user namespace and the specified TTL.
    expect(redisMock.set).toHaveBeenCalledWith(
      `sis:home:v1:${USER_ID}`,
      JSON.stringify({ view: "student", value: payload }),
      60,
    );
  });

  it("invalidates all home views for the affected user", async () => {
    // Arrange: the user has one shared home-cache key.

    // Act: invalidate the user after an academic mutation.
    await service.invalidateUser(USER_ID);

    // Assert: delete the full per-user cache entry.
    expect(redisMock.delete).toHaveBeenCalledWith(`sis:home:v1:${USER_ID}`);
  });
});
