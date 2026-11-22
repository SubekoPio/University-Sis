// Purpose: Coordinate programme validation, parent relationships, and persistence.
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AwardLevel } from "@prisma/client";
import type { Programme } from "@prisma/client";
import {
  normalizeCode,
  normalizeRequiredText,
  rethrowUniqueConflict,
  requireUpdateFields,
  validateUuid,
} from "./academic.validation.js";
import type {
  CreateProgrammeInput,
  ProgrammeListFilter,
  UpdateProgrammeInput,
} from "./academic.types.js";
import { ProgrammesRepository } from "./programmes.repository.js";

/** Provides programme management operations to academic feature modules. */
@Injectable()
export class ProgrammesService {
  /** Receives the programme repository. */
  constructor(private readonly repository: ProgrammesRepository) {}

  /** Creates a programme under an active department. */
  async createProgramme(input: CreateProgrammeInput): Promise<Programme> {
    try {
      const created = await this.repository.create(this.normalizeCreateInput(input));
      if (created === null) {
        throw new NotFoundException("Active department not found.");
      }

      return created;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A programme with this code already exists.");
    }
  }

  /** Lists active programmes, optionally filtered by department. */
  listProgrammes(filter: ProgrammeListFilter = {}): Promise<Programme[]> {
    return this.repository.list(
      filter.departmentId === undefined
        ? {}
        : { departmentId: validateUuid(filter.departmentId, "Department ID") },
    );
  }

  /** Finds an active programme or throws when it does not exist. */
  async getProgramme(id: string): Promise<Programme> {
    const programme = await this.repository.findById(validateUuid(id, "Programme ID"));
    if (programme === null) {
      throw new NotFoundException("Programme not found.");
    }

    return programme;
  }

  /** Updates an active programme's parent or academic details. */
  async updateProgramme(id: string, input: UpdateProgrammeInput): Promise<Programme> {
    const programmeId = validateUuid(id, "Programme ID");
    requireUpdateFields(input, "programme");
    const data: UpdateProgrammeInput = {
      ...(input.departmentId === undefined
        ? {}
        : { departmentId: validateUuid(input.departmentId, "Department ID") }),
      ...(input.code === undefined ? {} : { code: normalizeCode(input.code, "Programme code") }),
      ...(input.name === undefined
        ? {}
        : { name: normalizeRequiredText(input.name, "Programme name") }),
      ...(input.awardLevel === undefined
        ? {}
        : { awardLevel: this.validateAwardLevel(input.awardLevel) }),
      ...(input.durationYears === undefined
        ? {}
        : { durationYears: this.validateDuration(input.durationYears) }),
    };

    try {
      const updated = await this.repository.update(programmeId, data);
      if (updated === null) {
        throw new NotFoundException("Programme or active department not found.");
      }

      return updated;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A programme with this code already exists.");
    }
  }

  /** Deletes an unreferenced programme or soft-deletes a referenced programme. */
  async deleteProgramme(id: string): Promise<void> {
    const deleted = await this.repository.delete(validateUuid(id, "Programme ID"), new Date());
    if (deleted === null) {
      throw new NotFoundException("Programme not found.");
    }
  }

  private normalizeCreateInput(input: CreateProgrammeInput): CreateProgrammeInput {
    return {
      departmentId: validateUuid(input.departmentId, "Department ID"),
      code: normalizeCode(input.code, "Programme code"),
      name: normalizeRequiredText(input.name, "Programme name"),
      awardLevel: this.validateAwardLevel(input.awardLevel),
      durationYears: this.validateDuration(input.durationYears),
    };
  }

  private validateAwardLevel(awardLevel: AwardLevel): AwardLevel {
    if (!Object.values(AwardLevel).includes(awardLevel)) {
      throw new BadRequestException("The selected award level is invalid.");
    }

    return awardLevel;
  }

  private validateDuration(durationYears: number): number {
    if (!Number.isSafeInteger(durationYears) || durationYears < 1) {
      throw new BadRequestException("Programme duration must be a positive whole number of years.");
    }

    return durationYears;
  }
}
