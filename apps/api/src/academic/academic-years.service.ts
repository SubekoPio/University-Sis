// Purpose: Coordinate academic-year creation, intake configuration, and persistence.
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AcademicYear } from "@prisma/client";
import {
  normalizeRequiredText,
  rethrowUniqueConflict,
  requireUpdateFields,
  validateAcademicYearRange,
  validateDate,
  validateIntakeWindow,
  validateNoOverlappingIntakes,
  validateThreeIntakes,
  validateUuid,
} from "./academic.validation.js";
import type { AcademicYearWithIntakes } from "./academic-years.repository.js";
import type { CreateAcademicYearInput, UpdateAcademicYearInput } from "./academic.types.js";
import { AcademicYearsRepository } from "./academic-years.repository.js";

/** Provides academic-year management operations to academic feature modules. */
@Injectable()
export class AcademicYearsService {
  /** Receives the academic-year repository. */
  constructor(private readonly repository: AcademicYearsRepository) {}

  /** Creates an academic year and its three configured intakes atomically. */
  async createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYearWithIntakes> {
    if (!Array.isArray(input.intakes)) {
      throw new BadRequestException("Exactly three intake definitions are required.");
    }

    const label = normalizeRequiredText(input.label, "Academic-year label");
    const startDate = validateDate(input.startDate, "Academic-year start date");
    const endDate = validateDate(input.endDate, "Academic-year end date");
    validateAcademicYearRange(startDate, endDate);

    const intakes = input.intakes.map((intake) => ({
      sequence: intake.sequence,
      name: normalizeRequiredText(intake.name, "Intake name"),
      startDate: validateDate(intake.startDate, "Intake start date"),
      endDate: validateDate(intake.endDate, "Intake end date"),
      selectionOpensAt: validateDate(intake.selectionOpensAt, "Selection opening date"),
      selectionClosesAt: validateDate(intake.selectionClosesAt, "Selection closing date"),
    }));
    validateThreeIntakes(intakes, startDate, endDate);

    try {
      return await this.repository.createWithIntakes({ label, startDate, endDate }, intakes);
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "An academic year with this label already exists.");
    }
  }

  /** Lists active academic years. */
  listAcademicYears(): Promise<AcademicYear[]> {
    return this.repository.list();
  }

  /** Finds an active academic year and its intakes. */
  async getAcademicYear(id: string): Promise<AcademicYearWithIntakes> {
    const academicYear = await this.repository.findById(validateUuid(id, "Academic-year ID"));
    if (academicYear === null) {
      throw new NotFoundException("Academic year not found.");
    }

    return academicYear;
  }

  /** Updates an academic year without invalidating its active intake dates. */
  async updateAcademicYear(
    id: string,
    input: UpdateAcademicYearInput,
  ): Promise<AcademicYearWithIntakes> {
    const academicYearId = validateUuid(id, "Academic-year ID");
    requireUpdateFields(input, "academic-year");
    const current = await this.repository.findById(academicYearId);
    if (current === null) {
      throw new NotFoundException("Academic year not found.");
    }

    const data: UpdateAcademicYearInput = {
      ...(input.label === undefined
        ? {}
        : { label: normalizeRequiredText(input.label, "Academic-year label") }),
      ...(input.startDate === undefined
        ? {}
        : {
            startDate: validateDate(input.startDate, "Academic-year start date"),
          }),
      ...(input.endDate === undefined
        ? {}
        : { endDate: validateDate(input.endDate, "Academic-year end date") }),
    };
    const startDate = data.startDate ?? current.startDate;
    const endDate = data.endDate ?? current.endDate;
    validateAcademicYearRange(startDate, endDate);
    const allIntakes = await this.repository.findAllIntakesByYear(academicYearId);
    if (allIntakes === null) {
      throw new NotFoundException("Academic year not found.");
    }
    if (allIntakes.length > 3) {
      throw new BadRequestException("An academic year cannot contain more than three intakes.");
    }
    for (const intake of allIntakes) {
      validateIntakeWindow(intake, startDate, endDate);
    }
    validateNoOverlappingIntakes(allIntakes);

    try {
      const updated = await this.repository.update(academicYearId, data);
      if (updated === null) {
        throw new NotFoundException("Academic year not found.");
      }

      return updated;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "An academic year with this label already exists.");
    }
  }

  /** Deletes an unreferenced year or soft-deletes a year containing intake history. */
  async deleteAcademicYear(id: string): Promise<void> {
    const deleted = await this.repository.delete(validateUuid(id, "Academic-year ID"), new Date());
    if (deleted === null) {
      throw new NotFoundException("Academic year not found.");
    }
  }
}
