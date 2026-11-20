// Purpose: Apply permission-gated business rules for administrator-managed accounts.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, UserStatus } from "@prisma/client";
import { isEmail } from "class-validator";
import { randomBytes } from "node:crypto";
import { RbacService } from "../common/rbac/rbac.service.js";
import { EMAIL_SERVICE } from "../auth/email/email-service.interface.js";
import type { EmailService } from "../auth/email/email-service.interface.js";
import { createTemporaryCredentialsEmail } from "../auth/email/email-templates.js";
import { PasswordHashingService } from "../auth/password-hashing.service.js";
import { AdminUsersRepository, type AdminManagedUser } from "./admin-users.repository.js";

const ADMIN_USER_PERMISSION = "admin:user:manage";
const DEFAULT_TEMP_PASSWORD_TTL_DAYS = 7;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/** Input used to create an administrator-provisioned account. */
export interface CreateAdminUserDto {
  email: string;
  name: string;
  roleIds: string[];
}

/** Search, role, status, and pagination filters for managed accounts. */
export interface ListAdminUsersFilters {
  search?: string;
  role?: string;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

/** A safe account-management response and credential-delivery outcome. */
export interface AdminUserCreationResult {
  user: AdminManagedUser;
  credentialsEmailSent: boolean;
}

/** A paginated set of safe account records. */
export interface AdminUserPage {
  users: AdminManagedUser[];
  total: number;
  page: number;
  pageSize: number;
}

/** Enforces administrator permissions and account lifecycle business rules. */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  private readonly temporaryPasswordTtlDays: number;

  /**
   *
   */
  constructor(
    private readonly repository: AdminUsersRepository,
    private readonly passwordHashing: PasswordHashingService,
    private readonly rbacService: RbacService,
    private readonly config: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {
    this.temporaryPasswordTtlDays =
      config.get<number>("TEMP_PASSWORD_TTL_DAYS") ?? DEFAULT_TEMP_PASSWORD_TTL_DAYS;
    if (!Number.isSafeInteger(this.temporaryPasswordTtlDays) || this.temporaryPasswordTtlDays < 1) {
      throw new Error("TEMP_PASSWORD_TTL_DAYS must be a positive integer.");
    }
  }

  /** Creates an account and emails its temporary credentials without returning the password. */
  async createUser(dto: CreateAdminUserDto, adminId: string): Promise<AdminUserCreationResult> {
    await this.assertCanManageUsers(adminId);
    const email = this.normalizeEmail(dto.email);
    const name = this.normalizeName(dto.name);
    const roleIds = this.normalizeRoleIds(dto.roleIds);
    await this.assertRolesExist(roleIds);
    await this.rejectAdminCapabilityGrant(roleIds);

    const now = new Date();
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.passwordHashing.hashPassword(temporaryPassword);
    let user: AdminManagedUser;
    try {
      user = await this.repository.createUser({
        email,
        name,
        passwordHash,
        roleIds,
        createdById: adminId,
        temporaryPasswordExpiresAt: this.getTemporaryPasswordExpiry(now),
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An account with this email already exists.");
      }

      throw error;
    }

    const credentialsEmailSent = await this.sendTemporaryCredentials(
      user,
      adminId,
      temporaryPassword,
      "created",
    );
    const updatedUser = credentialsEmailSent
      ? await this.repository.findManagedUser(user.id)
      : user;
    if (updatedUser === null) {
      throw new NotFoundException("The newly created user account no longer exists.");
    }

    return { user: updatedUser, credentialsEmailSent };
  }

  /** Rotates temporary credentials, revokes every session, and sends the new credentials. */
  async resendCredentials(
    userId: string,
    adminId: string,
  ): Promise<{ credentialsEmailSent: boolean }> {
    await this.assertCanManageUsers(adminId);
    const status = await this.repository.findUserStatus(userId);
    if (status === null) {
      throw new NotFoundException("User account not found.");
    }
    if (status !== UserStatus.ACTIVE) {
      throw new BadRequestException("Credentials can only be resent to an active account.");
    }

    const now = new Date();
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await this.passwordHashing.hashPassword(temporaryPassword);
    const user = await this.repository.replaceTemporaryCredentials(
      userId,
      adminId,
      passwordHash,
      this.getTemporaryPasswordExpiry(now),
      now,
    );
    if (user === null) {
      throw new ConflictException("The account changed before credentials could be resent.");
    }

    return {
      credentialsEmailSent: await this.sendTemporaryCredentials(
        user,
        adminId,
        temporaryPassword,
        "resent",
      ),
    };
  }

  /** Replaces role assignments and audits changes while requiring second approval for admin access. */
  async updateRoles(userId: string, roleIds: string[], adminId: string): Promise<AdminManagedUser> {
    await this.assertCanManageUsers(adminId);
    const requestedRoleIds = this.normalizeRoleIds(roleIds, true);
    await this.assertRolesExist(requestedRoleIds);

    const currentRoleIds = await this.repository.findUserRoleIds(userId);
    if (currentRoleIds === null) {
      throw new NotFoundException("User account not found.");
    }

    const combinedRoleIds = [...new Set([...currentRoleIds, ...requestedRoleIds])];
    const adminCapabilityRoleIds = new Set(
      await this.repository.findRoleIdsGrantingPermission(combinedRoleIds, ADMIN_USER_PERMISSION),
    );
    const removedAdminCapability = currentRoleIds.some(
      (roleId) => adminCapabilityRoleIds.has(roleId) && !requestedRoleIds.includes(roleId),
    );
    const addedAdminCapability = requestedRoleIds.some(
      (roleId) => adminCapabilityRoleIds.has(roleId) && !currentRoleIds.includes(roleId),
    );

    if (removedAdminCapability && userId === adminId) {
      throw new ForbiddenException(
        "An administrator cannot remove their own administrator access.",
      );
    }
    if (removedAdminCapability || addedAdminCapability) {
      throw new ForbiddenException(
        "Admin-capability changes require a separate second-administrator approval workflow.",
      );
    }

    const result = await this.repository.replaceUserRoles(userId, requestedRoleIds, adminId);
    if (result.user === null) {
      throw new NotFoundException("User account not found.");
    }
    if (result.changed) {
      await this.rbacService.invalidateAuthorizationSnapshot(userId);
    }

    return result.user;
  }

  /** Deactivates another account, requires a reason, and revokes its sessions. */
  async deactivateUser(userId: string, adminId: string, reason: string): Promise<AdminManagedUser> {
    await this.assertCanManageUsers(adminId);
    if (userId === adminId) {
      throw new ForbiddenException("An administrator cannot deactivate their own account.");
    }
    const normalizedReason = this.normalizeReason(reason);
    const status = await this.repository.findUserStatus(userId);
    if (status === null) {
      throw new NotFoundException("User account not found.");
    }
    if (status === UserStatus.DEACTIVATED) {
      throw new ConflictException("The account is already deactivated.");
    }

    const user = await this.repository.deactivateUser(
      userId,
      adminId,
      normalizedReason,
      new Date(),
    );
    if (user === null) {
      throw new ConflictException("The account changed before it could be deactivated.");
    }

    return user;
  }

  /** Reactivates a deactivated account and records the required reason. */
  async reactivateUser(userId: string, adminId: string, reason: string): Promise<AdminManagedUser> {
    await this.assertCanManageUsers(adminId);
    const normalizedReason = this.normalizeReason(reason);
    const status = await this.repository.findUserStatus(userId);
    if (status === null) {
      throw new NotFoundException("User account not found.");
    }
    if (status !== UserStatus.DEACTIVATED) {
      throw new ConflictException("Only a deactivated account can be reactivated.");
    }

    const user = await this.repository.reactivateUser(userId, adminId, normalizedReason);
    if (user === null) {
      throw new ConflictException("The account changed before it could be reactivated.");
    }

    return user;
  }

  /** Searches and paginates managed accounts without exposing password data. */
  async listUsers(filters: ListAdminUsersFilters, adminId: string): Promise<AdminUserPage> {
    await this.assertCanManageUsers(adminId);
    if (filters.status !== undefined && !Object.values(UserStatus).includes(filters.status)) {
      throw new BadRequestException("The requested account status is invalid.");
    }
    const page = filters.page ?? DEFAULT_PAGE;
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException("Page must be a positive integer.");
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new BadRequestException(`Page size must be between 1 and ${MAX_PAGE_SIZE}.`);
    }
    const skip = (page - 1) * pageSize;
    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException("Page offset is outside the supported range.");
    }

    const search = filters.search?.trim();
    const role = filters.role?.trim();
    const result = await this.repository.listUsers({
      ...(search ? { search } : {}),
      ...(role ? { role } : {}),
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      skip,
      take: pageSize,
    });

    return { ...result, page, pageSize };
  }

  private async assertCanManageUsers(adminId: string): Promise<void> {
    const status = await this.repository.findUserStatus(adminId);
    if (status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        "An active account with user-management permission is required.",
      );
    }

    const snapshot = await this.rbacService.getAuthorizationSnapshot(adminId);
    if (!snapshot.permissions.includes(ADMIN_USER_PERMISSION)) {
      throw new ForbiddenException("The admin:user:manage permission is required.");
    }
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    const existing = new Set(await this.repository.findExistingRoleIds(roleIds));
    if (roleIds.some((roleId) => !existing.has(roleId))) {
      throw new BadRequestException("One or more requested roles do not exist.");
    }
  }

  private async rejectAdminCapabilityGrant(roleIds: string[]): Promise<void> {
    const elevatedRoles = await this.repository.findRoleIdsGrantingPermission(
      roleIds,
      ADMIN_USER_PERMISSION,
    );
    if (elevatedRoles.length > 0) {
      throw new ForbiddenException(
        "Admin-capability changes require a separate second-administrator approval workflow.",
      );
    }
  }

  private async sendTemporaryCredentials(
    user: AdminManagedUser,
    adminId: string,
    temporaryPassword: string,
    operation: "created" | "resent",
  ): Promise<boolean> {
    const loginUrl = this.config.get<string>("APP_URL");
    if (loginUrl === undefined || loginUrl.trim().length === 0) {
      throw new Error("APP_URL must be configured before sending credentials.");
    }
    const signInUrl = new URL("/login", loginUrl).toString();

    try {
      await this.emailService.send({
        to: user.email,
        subject: "Your University SIS account credentials",
        html: createTemporaryCredentialsEmail({
          name: user.name ?? "",
          email: user.email,
          temporaryPassword,
          loginUrl: signInUrl,
          expiresAt: user.temporaryPasswordExpiresAt,
        }),
      });
    } catch {
      this.logger.error(
        "Temporary credential email delivery failed; an administrator can resend it.",
      );
      await this.repository.recordCredentialsEmailFailure(user.id, adminId, operation);
      return false;
    }

    await this.repository.recordCredentialsEmailSent(user.id, adminId, operation);
    return true;
  }

  private normalizeEmail(email: string): string {
    if (typeof email !== "string") {
      throw new BadRequestException("A valid email address is required.");
    }
    const normalized = email.trim().toLowerCase();
    if (!isEmail(normalized)) {
      throw new BadRequestException("A valid email address is required.");
    }

    return normalized;
  }

  private normalizeName(name: string): string {
    if (typeof name !== "string") {
      throw new BadRequestException("A user name is required.");
    }
    const normalized = name.trim();
    if (normalized.length === 0) {
      throw new BadRequestException("A user name is required.");
    }

    return normalized;
  }

  private normalizeReason(reason: string): string {
    if (typeof reason !== "string") {
      throw new BadRequestException("A reason is required.");
    }
    const normalized = reason.trim();
    if (normalized.length === 0) {
      throw new BadRequestException("A reason is required.");
    }

    return normalized;
  }

  private normalizeRoleIds(roleIds: string[], allowEmpty = false): string[] {
    if (!Array.isArray(roleIds)) {
      throw new BadRequestException("Role IDs must be provided as a list.");
    }
    if (roleIds.some((roleId) => typeof roleId !== "string")) {
      throw new BadRequestException("Role IDs must be strings.");
    }
    const normalized = [...new Set(roleIds.map((roleId) => roleId.trim()))];
    if (
      normalized.some((roleId) => roleId.length === 0) ||
      (!allowEmpty && normalized.length === 0)
    ) {
      throw new BadRequestException("At least one valid role ID is required.");
    }

    return normalized;
  }

  private generateTemporaryPassword(): string {
    return randomBytes(32).toString("base64url");
  }

  private getTemporaryPasswordExpiry(now: Date): Date {
    const expiresAt = new Date(now.getTime() + this.temporaryPasswordTtlDays * MS_PER_DAY);
    if (!Number.isFinite(expiresAt.getTime())) {
      throw new Error("TEMP_PASSWORD_TTL_DAYS produced an invalid expiration date.");
    }

    return expiresAt;
  }
}
