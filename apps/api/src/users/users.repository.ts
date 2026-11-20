// Purpose: Keep Prisma user queries behind a repository boundary.
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const authenticationUserSelect = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  emailVerified: true,
  mustChangePassword: true,
  temporaryPasswordExpiresAt: true,
} satisfies Prisma.UserSelect;

const publicUserSelect = {
  id: true,
  email: true,
  status: true,
  emailVerified: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** User fields needed only by authentication logic. */
export type AuthenticationUser = Prisma.UserGetPayload<{
  select: typeof authenticationUserSelect;
}>;

/** User fields safe to return from registration. */
export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

/** Performs user persistence operations using Prisma. */
@Injectable()
export class UsersRepository {
  /**
   *
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Looks up a user by normalized email for credential verification. */
  findForAuthenticationByEmail(email: string): Promise<AuthenticationUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: authenticationUserSelect,
    });
  }

  /** Looks up a user by ID for refresh-token validation. */
  findForAuthenticationById(id: string): Promise<AuthenticationUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: authenticationUserSelect,
    });
  }

  /** Creates an account without returning its password hash. */
  create(email: string, passwordHash: string): Promise<PublicUser> {
    return this.prisma.user.create({
      data: { email, passwordHash },
      select: publicUserSelect,
    });
  }
}
