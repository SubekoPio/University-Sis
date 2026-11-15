// Purpose: Verify Argon2id password hashing behavior.
import { describe, expect, it } from "vitest";
import { PasswordHashingService } from "./password-hashing.service.js";

describe("PasswordHashingService", () => {
  it("hashes passwords with Argon2id and rejects a different password", async () => {
    // Arrange: create the password hasher and choose a test-only password.
    const passwordHashing = new PasswordHashingService();
    const password = "test-password-for-argon2";

    // Act: hash and verify the original and a different password.
    const passwordHash = await passwordHashing.hashPassword(password);
    const verifiesOriginal = await passwordHashing.verifyPassword(passwordHash, password);
    const verifiesDifferent = await passwordHashing.verifyPassword(
      passwordHash,
      "different-password",
    );

    // Assert: the stored value is an Argon2id hash and verifies only its password.
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(verifiesOriginal).toBe(true);
    expect(verifiesDifferent).toBe(false);
  });
});
