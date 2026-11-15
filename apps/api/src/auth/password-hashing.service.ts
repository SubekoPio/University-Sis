// Purpose: Hash and verify user passwords with Argon2id.
import { Injectable } from "@nestjs/common";
import { argon2id, hash, verify } from "argon2";

/** Encapsulates password hashing so plaintext passwords are never persisted. */
@Injectable()
export class PasswordHashingService {
  /** Hashes a password using Argon2id. */
  hashPassword(password: string): Promise<string> {
    return hash(password, { type: argon2id });
  }

  /** Verifies a plaintext password against its Argon2 hash. */
  verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
