// Purpose: Coordinate department validation, parent relationships, and persistence.
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Department } from "@prisma/client";
import {
  normalizeCode,
  normalizeRequiredText,
  rethrowUniqueConflict,
  requireUpdateFields,
  validateUuid,
} from "./academic.validation.js";
import type {
  CreateDepartmentInput,
  DepartmentListFilter,
  UpdateDepartmentInput,
} from "./academic.types.js";
import { DepartmentsRepository } from "./departments.repository.js";

/** Provides department management operations to academic feature modules. */
@Injectable()
export class DepartmentsService {
  /** Receives the department repository. */
  constructor(private readonly repository: DepartmentsRepository) {}

  /** Creates a department under an active faculty. */
  async createDepartment(input: CreateDepartmentInput): Promise<Department> {
    try {
      const created = await this.repository.create({
        facultyId: validateUuid(input.facultyId, "Faculty ID"),
        code: normalizeCode(input.code, "Department code"),
        name: normalizeRequiredText(input.name, "Department name"),
      });
      if (created === null) {
        throw new NotFoundException("Active faculty not found.");
      }

      return created;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A department with this code already exists.");
    }
  }

  /** Lists active departments, optionally filtered by faculty. */
  listDepartments(filter: DepartmentListFilter = {}): Promise<Department[]> {
    return this.repository.list(
      filter.facultyId === undefined
        ? {}
        : { facultyId: validateUuid(filter.facultyId, "Faculty ID") },
    );
  }

  /** Finds an active department or throws when it does not exist. */
  async getDepartment(id: string): Promise<Department> {
    const department = await this.repository.findById(validateUuid(id, "Department ID"));
    if (department === null) {
      throw new NotFoundException("Department not found.");
    }

    return department;
  }

  /** Updates an active department's parent, code, or name. */
  async updateDepartment(id: string, input: UpdateDepartmentInput): Promise<Department> {
    const departmentId = validateUuid(id, "Department ID");
    requireUpdateFields(input, "department");
    const data: UpdateDepartmentInput = {
      ...(input.facultyId === undefined
        ? {}
        : { facultyId: validateUuid(input.facultyId, "Faculty ID") }),
      ...(input.code === undefined ? {} : { code: normalizeCode(input.code, "Department code") }),
      ...(input.name === undefined
        ? {}
        : { name: normalizeRequiredText(input.name, "Department name") }),
    };

    try {
      const updated = await this.repository.update(departmentId, data);
      if (updated === null) {
        throw new NotFoundException("Department or active faculty not found.");
      }

      return updated;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A department with this code already exists.");
    }
  }

  /** Deletes an unreferenced department or soft-deletes a referenced department. */
  async deleteDepartment(id: string): Promise<void> {
    const deleted = await this.repository.delete(validateUuid(id, "Department ID"), new Date());
    if (deleted === null) {
      throw new NotFoundException("Department not found.");
    }
  }
}
