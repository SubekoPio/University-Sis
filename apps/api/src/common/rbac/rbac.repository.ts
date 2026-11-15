// Purpose: Resolve user roles, role permissions, and active sessions from Prisma.
import { Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service.js";
import type { AuthorizationSnapshot } from "./rbac.types.js";

/** Performs RBAC and session lookups against the persisted schema. */
@Injectable()
export class RbacRepository {
  /**
   *
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Loads all assigned role names and their granted permission keys. */
  async getAuthorizationSnapshot(userId: string): Promise<AuthorizationSnapshot> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            name: true,
            permissions: {
              select: {
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        },
      },
    });

    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const assignment of assignments) {
      roles.add(assignment.role.name);
      for (const grant of assignment.role.permissions) {
        permissions.add(grant.permission.key);
      }
    }

    return {
      roles: [...roles].sort(),
      permissions: [...permissions].sort(),
    };
  }

  /** Confirms the token's session is active and belongs to an active user. */
  async isActiveSession(userId: string, sessionId: string, now: Date): Promise<boolean> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { is: { status: UserStatus.ACTIVE } },
      },
      select: { id: true },
    });

    return session !== null;
  }
}
