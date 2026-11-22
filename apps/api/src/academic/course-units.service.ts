// Purpose: Coordinate course-unit catalogue, general-unit eligibility, and lifecycle operations.
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseUnitLevel, CourseUnitStatus } from "@prisma/client";
import type { CourseUnitDetails, CourseUnitPersistenceInput } from "./course-units.repository.js";
import { CourseUnitsRepository } from "./course-units.repository.js";
import {
  normalizeCode,
  normalizeRequiredText,
  rethrowUniqueConflict,
  requireUpdateFields,
  validateUuid,
} from "./academic.validation.js";
import type {
  CourseUnitGeneralConfiguration,
  CourseUnitListFilter,
  CreateCourseUnitInput,
  UpdateCourseUnitInput,
} from "./academic-catalog.types.js";
import { DepartmentsService } from "./departments.service.js";

/** Provides course-unit catalogue operations to academic feature modules. */
@Injectable()
export class CourseUnitsService {
  /** Receives the repository and active-department validator. */
  constructor(
    private readonly repository: CourseUnitsRepository,
    private readonly departmentsService: DepartmentsService,
  ) {}

  /** Creates a course unit under an active owner department. */
  async createCourseUnit(input: CreateCourseUnitInput): Promise<CourseUnitDetails> {
    const ownerDepartmentId = validateUuid(input.ownerDepartmentId, "Owner department ID");
    await this.departmentsService.getDepartment(ownerDepartmentId);

    const general = this.normalizeGeneralConfiguration({
      isGeneral: input.isGeneral ?? false,
      ...(input.openToAllFaculties === undefined
        ? {}
        : { openToAllFaculties: input.openToAllFaculties }),
      ...(input.eligibleFacultyIds === undefined
        ? {}
        : { eligibleFacultyIds: input.eligibleFacultyIds }),
    });
    await this.validateEligibleFaculties(general.eligibleFacultyIds);

    const data: CourseUnitPersistenceInput = {
      code: normalizeCode(input.code, "Course-unit code"),
      name: normalizeRequiredText(input.name, "Course-unit name"),
      creditUnits: this.validateCreditUnits(input.creditUnits),
      level: this.validateLevel(input.level),
      ownerDepartmentId,
      status: this.validateStatus(input.status ?? CourseUnitStatus.ACTIVE),
      ...general,
    };

    try {
      const created = await this.repository.create(data);
      if (created === null) {
        throw new NotFoundException("Owner department or an eligible faculty was not found.");
      }
      return created;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A course unit with this code already exists.");
    }
  }

  /** Lists course units with optional catalogue filters. */
  listCourseUnits(filter: CourseUnitListFilter = {}): Promise<CourseUnitDetails[]> {
    return this.repository.list({
      ...(filter.search === undefined || filter.search.trim().length === 0
        ? {}
        : { search: filter.search.trim() }),
      ...(filter.status === undefined ? {} : { status: this.validateStatus(filter.status) }),
      ...(filter.level === undefined ? {} : { level: this.validateLevel(filter.level) }),
      ...(filter.ownerDepartmentId === undefined
        ? {}
        : {
            ownerDepartmentId: validateUuid(filter.ownerDepartmentId, "Owner department ID"),
          }),
      ...(filter.isGeneral === undefined ? {} : { isGeneral: filter.isGeneral }),
    });
  }

  /** Finds one course unit or throws when it or its owner is inactive. */
  async getCourseUnit(id: string): Promise<CourseUnitDetails> {
    const courseUnit = await this.repository.findById(validateUuid(id, "Course-unit ID"));
    if (courseUnit === null) {
      throw new NotFoundException("Course unit not found.");
    }
    return courseUnit;
  }

  /** Finds active-owner course units for curriculum and offering validation. */
  async getCourseUnitsByIds(ids: string[]): Promise<CourseUnitDetails[]> {
    const uniqueIds = [...new Set(ids.map((id) => validateUuid(id, "Course-unit ID")))];
    return this.repository.findByIds(uniqueIds);
  }

  /** Updates catalogue fields without changing the general-unit eligibility set. */
  async updateCourseUnit(id: string, input: UpdateCourseUnitInput): Promise<CourseUnitDetails> {
    const courseUnitId = validateUuid(id, "Course-unit ID");
    requireUpdateFields(input, "course-unit");

    const data: UpdateCourseUnitInput = {
      ...(input.code === undefined ? {} : { code: normalizeCode(input.code, "Course-unit code") }),
      ...(input.name === undefined
        ? {}
        : { name: normalizeRequiredText(input.name, "Course-unit name") }),
      ...(input.creditUnits === undefined
        ? {}
        : { creditUnits: this.validateCreditUnits(input.creditUnits) }),
      ...(input.level === undefined ? {} : { level: this.validateLevel(input.level) }),
      ...(input.ownerDepartmentId === undefined
        ? {}
        : {
            ownerDepartmentId: validateUuid(input.ownerDepartmentId, "Owner department ID"),
          }),
      ...(input.status === undefined ? {} : { status: this.validateStatus(input.status) }),
    };

    if (data.ownerDepartmentId !== undefined) {
      await this.departmentsService.getDepartment(data.ownerDepartmentId);
    }

    try {
      const updated = await this.repository.update(courseUnitId, data);
      if (updated === null) {
        throw new NotFoundException("Course unit or active owner not found.");
      }
      return updated;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "A course unit with this code already exists.");
    }
  }

  /** Marks a unit general and replaces its faculty eligibility configuration. */
  async configureGeneralEligibility(
    id: string,
    input: CourseUnitGeneralConfiguration,
  ): Promise<CourseUnitDetails> {
    const courseUnitId = validateUuid(id, "Course-unit ID");
    await this.getCourseUnit(courseUnitId);
    const general = this.normalizeGeneralConfiguration(input);
    await this.validateEligibleFaculties(general.eligibleFacultyIds);

    const updated = await this.repository.configureGeneralEligibility(courseUnitId, general);
    if (updated === null) {
      throw new NotFoundException("Course unit or an eligible faculty was not found.");
    }
    return updated;
  }

  /** Deletes an unused unit or retires it when academic records reference it. */
  async deleteCourseUnit(id: string): Promise<void> {
    const deleted = await this.repository.deleteOrRetire(validateUuid(id, "Course-unit ID"));
    if (!deleted) {
      throw new NotFoundException("Course unit not found.");
    }
  }

  private normalizeGeneralConfiguration(input: CourseUnitGeneralConfiguration): {
    isGeneral: boolean;
    openToAllFaculties: boolean;
    eligibleFacultyIds: string[];
  } {
    if (input.eligibleFacultyIds !== undefined && !Array.isArray(input.eligibleFacultyIds)) {
      throw new BadRequestException("Eligible faculty IDs must be an array.");
    }
    if (input.openToAllFaculties !== undefined && typeof input.openToAllFaculties !== "boolean") {
      throw new BadRequestException("Open-to-all-faculties state must be a boolean.");
    }
    const eligibleFacultyIds = [
      ...new Set(
        (input.eligibleFacultyIds ?? []).map((id) => validateUuid(id, "Eligible faculty ID")),
      ),
    ];
    if (typeof input.isGeneral !== "boolean") {
      throw new BadRequestException("General-unit state must be specified.");
    }
    if (!input.isGeneral) {
      if (input.openToAllFaculties === true || eligibleFacultyIds.length > 0) {
        throw new BadRequestException(
          "A non-general unit cannot have general-unit faculty eligibility.",
        );
      }
      return {
        isGeneral: false,
        openToAllFaculties: false,
        eligibleFacultyIds: [],
      };
    }

    const openToAllFaculties = input.openToAllFaculties ?? false;
    if (openToAllFaculties && eligibleFacultyIds.length > 0) {
      throw new BadRequestException("Open-to-all units must not also list eligible faculties.");
    }
    if (!openToAllFaculties && eligibleFacultyIds.length === 0) {
      throw new BadRequestException(
        "A general unit must be open to all faculties or list eligible faculties.",
      );
    }
    return { isGeneral: true, openToAllFaculties, eligibleFacultyIds };
  }

  private async validateEligibleFaculties(ids: string[]): Promise<void> {
    const activeIds = await this.repository.findActiveFacultyIds(ids);
    if (activeIds.length !== ids.length) {
      throw new NotFoundException("One or more eligible faculties were not found.");
    }
  }

  private validateCreditUnits(creditUnits: number): number {
    if (!Number.isSafeInteger(creditUnits) || creditUnits < 1) {
      throw new BadRequestException("Course-unit credits must be a positive whole number.");
    }
    return creditUnits;
  }

  private validateLevel(level: CreateCourseUnitInput["level"]): CreateCourseUnitInput["level"] {
    if (!Object.values(CourseUnitLevel).includes(level)) {
      throw new BadRequestException("The selected course-unit level is invalid.");
    }
    return level;
  }

  private validateStatus(status: CreateCourseUnitInput["status"]): CourseUnitStatus {
    if (status === undefined || !Object.values(CourseUnitStatus).includes(status)) {
      throw new BadRequestException("The selected course-unit status is invalid.");
    }
    return status;
  }
}
