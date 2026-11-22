// Purpose: Coordinate faculty validation, lifecycle, and persistence.
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Faculty } from "@prisma/client";
import {
  rethrowUniqueConflict,
  normalizeCode,
  normalizeRequiredText,
  requireUpdateFields,
  validateUuid,
} from "./academic.validation.js";
import type { CreateFacultyInput, UpdateFacultyInput } from "./academic.types.js";
import { FacultiesRepository } from "./faculties.repository.js";

/** Provides faculty management operations to academic feature modules. */
@Injectable()
export class FacultiesService {
  /** Receives the faculty repository. */
  constructor(private readonly repository: FacultiesRepository) {}

  /** Creates a faculty after normalizing its code and name. */
  async createFaculty(input: CreateFacultyInput): Promise<Faculty> {
    try {
      return await this.repository.create({
        code: normalizeCode(input.code, "Faculty code"),
        name: normalizeRequiredText(input.name, "Faculty name"),
      });
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A faculty with this code already exists.");
    }
  }

  /** Lists active faculties. */
  listFaculties(): Promise<Faculty[]> {
    return this.repository.list();
  }

  /** Finds an active faculty or throws when it does not exist. */
  async getFaculty(id: string): Promise<Faculty> {
    const faculty = await this.repository.findById(validateUuid(id, "Faculty ID"));
    if (faculty === null) {
      throw new NotFoundException("Faculty not found.");
    }

    return faculty;
  }

  /** Updates an active faculty's code or name. */
  async updateFaculty(id: string, input: UpdateFacultyInput): Promise<Faculty> {
    const facultyId = validateUuid(id, "Faculty ID");
    requireUpdateFields(input, "faculty");
    const data: UpdateFacultyInput = {
      ...(input.code === undefined ? {} : { code: normalizeCode(input.code, "Faculty code") }),
      ...(input.name === undefined
        ? {}
        : { name: normalizeRequiredText(input.name, "Faculty name") }),
    };

    try {
      const updated = await this.repository.update(facultyId, data);
      if (updated === null) {
        throw new NotFoundException("Faculty not found.");
      }

      return updated;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A faculty with this code already exists.");
    }
  }

  /** Deletes an unreferenced faculty or soft-deletes a referenced faculty. */
  async deleteFaculty(id: string): Promise<void> {
    const deleted = await this.repository.delete(validateUuid(id, "Faculty ID"), new Date());
    if (deleted === null) {
      throw new NotFoundException("Faculty not found.");
    }
  }
}
