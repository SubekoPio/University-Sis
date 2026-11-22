// Purpose: Coordinate permission-gated lecturer-profile management.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import {
  isPrismaRequestError,
  normalizeRequiredText,
  validateUuid,
} from "./academic.validation.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import { LecturersRepository } from "./lecturers.repository.js";
import type { LecturerProfile } from "./lecturers.repository.js";
import type { CreateLecturerInput, LecturerListFilters, UpdateLecturerInput } from "./sis.types.js";

const LECTURER_MANAGE_PERMISSION = "academic:structure:manage";

/** Provides lecturer-profile management for existing user accounts. */
@Injectable()
export class LecturersService {
  /** Receives lecturer persistence and RBAC services. */
  constructor(
    private readonly repository: LecturersRepository,
    private readonly rbac: RbacService,
  ) {}

  /** Creates a lecturer profile linked to an active department and existing account. */
  async createLecturer(input: CreateLecturerInput, actorId: string): Promise<LecturerProfile> {
    await this.assertCanManage(actorId);
    const data: CreateLecturerInput = {
      userId: validateUuid(input.userId, "User ID"),
      departmentId: validateUuid(input.departmentId, "Department ID"),
      staffNumber: normalizeRequiredText(input.staffNumber, "Staff number").toUpperCase(),
    };

    try {
      const lecturer = await this.repository.create(data, actorId);
      if (lecturer === null) {
        throw new NotFoundException("Active user account or department not found.");
      }
      return lecturer;
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2002")) {
        throw new ConflictException("The staff number or user profile is already in use.");
      }
      throw error;
    }
  }

  /** Lists lecturer profiles, optionally filtered by department and search text. */
  async listLecturers(filters: LecturerListFilters, actorId: string): Promise<LecturerProfile[]> {
    await this.assertCanManage(actorId);
    return this.repository.list({
      ...(filters.departmentId === undefined
        ? {}
        : { departmentId: validateUuid(filters.departmentId, "Department ID") }),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    });
  }

  /** Finds a lecturer profile by ID. */
  async getLecturer(lecturerId: string, actorId: string): Promise<LecturerProfile> {
    await this.assertCanManage(actorId);
    const lecturer = await this.repository.findById(validateUuid(lecturerId, "Lecturer ID"));
    if (lecturer === null) {
      throw new NotFoundException("Lecturer not found.");
    }
    return lecturer;
  }

  /** Updates a lecturer's staff number or department and records the change. */
  async updateLecturer(
    lecturerId: string,
    input: UpdateLecturerInput,
    actorId: string,
  ): Promise<LecturerProfile> {
    await this.assertCanManage(actorId);
    const id = validateUuid(lecturerId, "Lecturer ID");
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException("At least one lecturer field must be provided.");
    }
    const data: UpdateLecturerInput = {
      ...(input.departmentId === undefined
        ? {}
        : { departmentId: validateUuid(input.departmentId, "Department ID") }),
      ...(input.staffNumber === undefined
        ? {}
        : { staffNumber: normalizeRequiredText(input.staffNumber, "Staff number").toUpperCase() }),
    };

    try {
      const updated = await this.repository.update(id, data, actorId);
      if (updated === null) {
        throw new NotFoundException("Lecturer or active department not found.");
      }
      return updated;
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2002")) {
        throw new ConflictException("A lecturer with this staff number already exists.");
      }
      throw error;
    }
  }

  private async assertCanManage(actorId: string): Promise<void> {
    const userId = validateUuid(actorId, "Actor ID");
    const status = await this.repository.findUserStatus(userId);
    if (status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        "An active account with academic-structure permission is required.",
      );
    }
    const permissions = (await this.rbac.getAuthorizationSnapshot(userId)).permissions;
    if (!permissions.includes(LECTURER_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`The ${LECTURER_MANAGE_PERMISSION} permission is required.`);
    }
  }
}
