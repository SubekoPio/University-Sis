// Purpose: Coordinate user account operations for authentication workflows.
import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticationUser, PublicUser } from "./users.repository.js";
import { UsersRepository } from "./users.repository.js";

/** Provides user account operations to feature services. */
@Injectable()
export class UsersService {
  /**
   *
   */
  constructor(private readonly usersRepository: UsersRepository) {}

  /** Finds a user and password hash for authentication only. */
  findForAuthenticationByEmail(email: string): Promise<AuthenticationUser | null> {
    return this.usersRepository.findForAuthenticationByEmail(email);
  }

  /** Finds a user and password hash by ID for authentication only. */
  findForAuthenticationById(id: string): Promise<AuthenticationUser | null> {
    return this.usersRepository.findForAuthenticationById(id);
  }

  /** Creates a user from an already-hashed password. */
  async createWithPasswordHash(email: string, passwordHash: string): Promise<PublicUser> {
    try {
      return await this.usersRepository.create(email, passwordHash);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An account with this email already exists.");
      }

      throw error;
    }
  }
}
