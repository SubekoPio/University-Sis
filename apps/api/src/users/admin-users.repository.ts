// Purpose: Persist administrator-managed accounts, role assignments, sessions, and audit events.
import { Injectable } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  emailVerified: true,
  mustChangePassword: true,
  temporaryPasswordExpiresAt: true,
  createdAt: true,
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

/** Safe account fields returned from administrator user-management operations. */
export type AdminManagedUser = Prisma.UserGetPayload<{
  select: typeof adminUserSelect;
}>;

/** Inputs required to create an administrator-provisioned account. */
export interface NewAdminManagedUser {
  email: string;
  name: string;
  passwordHash: string;
  roleIds: string[];
  createdById: string;
  temporaryPasswordExpiresAt: Date;
}

/** Filters and pagination values for listing managed accounts. */
export interface AdminUserListQuery {
  search?: string;
  role?: string;
  status?: UserStatus;
  skip: number;
  take: number;
}

/** A page of safe account records and its total matching count. */
export interface AdminUserListResult {
  users: AdminManagedUser[];
  total: number;
}

/** Performs account-management persistence operations using Prisma. */
@Injectable()
export class AdminUsersRepository {
  /**
   *
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Finds role IDs that grant the requested permission key. */
  async findRoleIdsGrantingPermission(roleIds: string[], permissionKey: string): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        permissions: { some: { permission: { key: permissionKey } } },
      },
      select: { id: true },
    });

    return roles.map(({ id }) => id);
  }

  /** Returns the requested role IDs that currently exist. */
  async findExistingRoleIds(roleIds: string[]): Promise<string[]> {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });

    return roles.map(({ id }) => id);
  }

  /** Creates an account, its role assignments, and its creation audit record atomically. */
  createUser(input: NewAdminManagedUser): Promise<AdminManagedUser> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: input.temporaryPasswordExpiresAt,
          createdById: input.createdById,
        },
        select: adminUserSelect,
      });

      await transaction.userRole.createMany({
        data: input.roleIds.map((roleId) => ({ userId: user.id, roleId })),
      });
      await transaction.auditLog.create({
        data: {
          actorId: input.createdById,
          action: "admin.user.created",
          resourceType: "user",
          resourceId: user.id,
          metadata: { roleIds: input.roleIds },
        },
      });

      return transaction.user.findUniqueOrThrow({
        where: { id: user.id },
        select: adminUserSelect,
      });
    });
  }

  /** Returns one account's lifecycle status, or null when it does not exist. */
  async findUserStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    return user?.status ?? null;
  }

  /** Returns a safe managed-user record, or null when it no longer exists. */
  findManagedUser(userId: string): Promise<AdminManagedUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: adminUserSelect,
    });
  }

  /** Returns the IDs of all roles currently assigned to an account. */
  async findUserRoleIds(userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: { select: { roleId: true } } },
    });

    return user?.roles.map(({ roleId }) => roleId) ?? null;
  }

  /** Replaces role assignments and records the exact change in the audit log. */
  async replaceUserRoles(
    userId: string,
    roleIds: string[],
    actorId: string,
  ): Promise<{ user: AdminManagedUser | null; changed: boolean }> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: { id: userId },
        select: { roles: { select: { roleId: true } } },
      });
      if (existing === null) {
        return { user: null, changed: false };
      }

      const currentRoleIds = existing.roles.map(({ roleId }) => roleId);
      const current = new Set(currentRoleIds);
      const requested = new Set(roleIds);
      const addedRoleIds = roleIds.filter((roleId) => !current.has(roleId));
      const removedRoleIds = currentRoleIds.filter((roleId) => !requested.has(roleId));

      if (removedRoleIds.length > 0) {
        await transaction.userRole.deleteMany({
          where: { userId, roleId: { in: removedRoleIds } },
        });
      }
      if (addedRoleIds.length > 0) {
        await transaction.userRole.createMany({
          data: addedRoleIds.map((roleId) => ({ userId, roleId })),
        });
      }

      if (addedRoleIds.length > 0 || removedRoleIds.length > 0) {
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "admin.user.roles_updated",
            resourceType: "user",
            resourceId: userId,
            metadata: { addedRoleIds, removedRoleIds },
          },
        });
      }

      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: adminUserSelect,
      });

      return {
        user,
        changed: addedRoleIds.length > 0 || removedRoleIds.length > 0,
      };
    });
  }

  /** Rotates a user's temporary password, revokes sessions, and records the request atomically. */
  async replaceTemporaryCredentials(
    userId: string,
    actorId: string,
    passwordHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<AdminManagedUser | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id: userId, status: UserStatus.ACTIVE },
        data: {
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "admin.user.credentials_resent",
          resourceType: "user",
          resourceId: userId,
        },
      });

      return transaction.user.findUnique({
        where: { id: userId },
        select: adminUserSelect,
      });
    });
  }

  /** Records successful delivery and enables verified-email login for active accounts. */
  async recordCredentialsEmailSent(
    userId: string,
    actorId: string,
    operation: "created" | "resent",
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      // Only a successfully delivered invite can satisfy the existing verified-email login gate.
      await transaction.user.updateMany({
        where: { id: userId, status: UserStatus.ACTIVE },
        data: { emailVerified: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "admin.user.credentials_email_sent",
          resourceType: "user",
          resourceId: userId,
          metadata: { operation, delivery: "sent" },
        },
      });
    });
  }

  /** Records failed delivery without retaining provider errors or credential material. */
  async recordCredentialsEmailFailure(
    userId: string,
    actorId: string,
    operation: "created" | "resent",
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: "admin.user.credentials_email_failed",
        resourceType: "user",
        resourceId: userId,
        metadata: { operation, delivery: "failed" },
      },
    });
  }

  /** Deactivates an account, revokes its sessions, and records the reason atomically. */
  async deactivateUser(
    userId: string,
    actorId: string,
    reason: string,
    now: Date,
  ): Promise<AdminManagedUser | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id: userId, status: { not: UserStatus.DEACTIVATED } },
        data: {
          status: UserStatus.DEACTIVATED,
          deactivatedAt: now,
          deactivatedById: actorId,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "admin.user.deactivated",
          resourceType: "user",
          resourceId: userId,
          reason,
        },
      });

      return transaction.user.findUnique({
        where: { id: userId },
        select: adminUserSelect,
      });
    });
  }

  /** Reactivates a deactivated account and records the required reason atomically. */
  async reactivateUser(
    userId: string,
    actorId: string,
    reason: string,
  ): Promise<AdminManagedUser | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id: userId, status: UserStatus.DEACTIVATED },
        data: {
          status: UserStatus.ACTIVE,
          deactivatedAt: null,
          deactivatedById: null,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      await transaction.auditLog.create({
        data: {
          actorId,
          action: "admin.user.reactivated",
          resourceType: "user",
          resourceId: userId,
          reason,
        },
      });

      return transaction.user.findUnique({
        where: { id: userId },
        select: adminUserSelect,
      });
    });
  }

  /** Lists safe account records and a count using the same filter. */
  async listUsers(query: AdminUserListQuery): Promise<AdminUserListResult> {
    const conditions: Prisma.UserWhereInput[] = [];
    if (query.search !== undefined) {
      conditions.push({
        OR: [
          { email: { contains: query.search, mode: "insensitive" } },
          { name: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    if (query.role !== undefined) {
      conditions.push({ roles: { some: { role: { name: query.role } } } });
    }
    if (query.status !== undefined) {
      conditions.push({ status: query.status });
    }

    const where: Prisma.UserWhereInput = conditions.length === 0 ? {} : { AND: conditions };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: adminUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}
