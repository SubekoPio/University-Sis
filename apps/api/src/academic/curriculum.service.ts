// Purpose: Coordinate programme curriculum placements, elective rules, and prerequisite validation.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProgrammeCourseUnitType } from "@prisma/client";
import type { CurriculumEntry, PrerequisiteEdge } from "./curriculum.repository.js";
import { CurriculumRepository } from "./curriculum.repository.js";
import { CourseUnitsService } from "./course-units.service.js";
import { rethrowUniqueConflict, validateUuid } from "./academic.validation.js";
import type {
  CurriculumCourseUnitInput,
  ElectiveCreditRuleInput,
} from "./academic-catalog.types.js";
import { DepartmentsService } from "./departments.service.js";
import { FacultiesService } from "./faculties.service.js";
import { ProgrammesService } from "./programmes.service.js";

/** Provides programme curriculum and prerequisite management operations. */
@Injectable()
export class CurriculumService {
  /** Receives the repository and academic catalogue validators. */
  constructor(
    private readonly repository: CurriculumRepository,
    private readonly programmesService: ProgrammesService,
    private readonly departmentsService: DepartmentsService,
    private readonly facultiesService: FacultiesService,
    private readonly courseUnitsService: CourseUnitsService,
  ) {}

  /** Lists curriculum placements for one programme study-year and intake slot. */
  async listCourseUnits(
    programmeId: string,
    studyYear: number,
    intakeSlot: number,
  ): Promise<CurriculumEntry[]> {
    const programme = await this.validateProgrammeSlot(programmeId, studyYear, intakeSlot);
    return this.repository.listCourseUnits(programme.id, studyYear, intakeSlot);
  }

  /** Replaces CORE and ELECTIVE placements for one programme curriculum slot. */
  async setCourseUnits(
    programmeId: string,
    studyYear: number,
    intakeSlot: number,
    placements: CurriculumCourseUnitInput[],
  ): Promise<CurriculumEntry[]> {
    const programme = await this.validateProgrammeSlot(programmeId, studyYear, intakeSlot);
    if (!Array.isArray(placements)) {
      throw new BadRequestException("Curriculum placements must be an array.");
    }

    const normalized = placements.map((placement) => ({
      courseUnitId: validateUuid(placement.courseUnitId, "Course-unit ID"),
      type: this.validatePlacementType(placement.type),
    }));
    const uniqueIds = new Set(normalized.map((placement) => placement.courseUnitId));
    if (uniqueIds.size !== normalized.length) {
      throw new BadRequestException(
        "A course unit can appear only once in a programme curriculum.",
      );
    }

    const courseUnits = await this.courseUnitsService.getCourseUnitsByIds([...uniqueIds]);
    if (courseUnits.length !== uniqueIds.size) {
      throw new NotFoundException("One or more active course units were not found.");
    }
    for (const courseUnit of courseUnits) {
      if (courseUnit.status !== "ACTIVE") {
        throw new ConflictException(
          `Course unit ${courseUnit.code} is not active for curriculum placement.`,
        );
      }
      if (
        courseUnit.isGeneral &&
        !courseUnit.openToAllFaculties &&
        !courseUnit.facultyEligibilities.some(
          (eligibility) => eligibility.facultyId === programme.department.facultyId,
        )
      ) {
        throw new ConflictException(
          `Course unit ${courseUnit.code} is not eligible for the programme's faculty.`,
        );
      }
    }

    try {
      const saved = await this.repository.replaceCourseUnits(
        programme.id,
        studyYear,
        intakeSlot,
        normalized,
      );
      if (saved === null) {
        throw new NotFoundException("Active programme not found.");
      }
      return saved;
    } catch (error: unknown) {
      rethrowUniqueConflict(
        error,
        "A course unit is already placed in this programme's curriculum.",
      );
    }
  }

  /** Lists elective-credit rules for one programme curriculum slot. */
  async listElectiveRules(programmeId: string, studyYear: number, intakeSlot: number) {
    const programme = await this.validateProgrammeSlot(programmeId, studyYear, intakeSlot);
    return this.repository.listElectiveRules(programme.id, studyYear, intakeSlot);
  }

  /** Replaces one slot's elective-credit rules; multiple rules are supported. */
  async setElectiveRules(
    programmeId: string,
    studyYear: number,
    intakeSlot: number,
    rules: ElectiveCreditRuleInput[],
  ) {
    const programme = await this.validateProgrammeSlot(programmeId, studyYear, intakeSlot);
    if (!Array.isArray(rules)) {
      throw new BadRequestException("Elective rules must be an array.");
    }
    const normalized = rules.map((rule) => {
      if (
        !Number.isSafeInteger(rule.minCredits) ||
        !Number.isSafeInteger(rule.maxCredits) ||
        rule.minCredits < 0 ||
        rule.maxCredits < rule.minCredits
      ) {
        throw new BadRequestException(
          "Elective credit bounds must be whole numbers with a non-negative minimum no greater than the maximum.",
        );
      }
      return { minCredits: rule.minCredits, maxCredits: rule.maxCredits };
    });

    const saved = await this.repository.replaceElectiveRules(
      programme.id,
      studyYear,
      intakeSlot,
      normalized,
    );
    if (saved === null) {
      throw new NotFoundException("Active programme not found.");
    }
    return saved;
  }

  /** Lists the prerequisites configured for one active course unit. */
  async listPrerequisites(courseUnitId: string) {
    const unit = await this.courseUnitsService.getCourseUnit(courseUnitId);
    return this.repository.listPrerequisites(unit.id);
  }

  /** Replaces prerequisites while rejecting self-links and any resulting cycle. */
  async setPrerequisites(
    courseUnitId: string,
    prerequisiteIds: string[],
  ): Promise<PrerequisiteEdge[]> {
    const unitId = validateUuid(courseUnitId, "Course-unit ID");
    const normalizedPrerequisiteIds = prerequisiteIds.map((id) =>
      validateUuid(id, "Prerequisite course-unit ID"),
    );
    const uniquePrerequisiteIds = [...new Set(normalizedPrerequisiteIds)];
    if (uniquePrerequisiteIds.length !== normalizedPrerequisiteIds.length) {
      throw new BadRequestException("A prerequisite course unit must be listed only once.");
    }
    if (uniquePrerequisiteIds.includes(unitId)) {
      throw new BadRequestException("A course unit cannot be its own prerequisite.");
    }

    const units = await this.courseUnitsService.getCourseUnitsByIds([
      unitId,
      ...uniquePrerequisiteIds,
    ]);
    if (units.length !== uniquePrerequisiteIds.length + 1) {
      throw new NotFoundException("One or more active course units were not found.");
    }
    if (units.some((unit) => unit.status !== "ACTIVE")) {
      throw new ConflictException("Only active course units can be prerequisites.");
    }

    const existingEdges = await this.repository.listPrerequisiteEdges();
    const candidateEdges = [
      ...existingEdges.filter((edge) => edge.courseUnitId !== unitId),
      ...uniquePrerequisiteIds.map((prerequisiteId) => ({
        courseUnitId: unitId,
        prerequisiteId,
      })),
    ];
    if (this.hasCycle(candidateEdges)) {
      throw new BadRequestException("The prerequisite changes would create a course-unit cycle.");
    }

    const saved = await this.repository.replacePrerequisites(unitId, uniquePrerequisiteIds);
    if (saved === null) {
      throw new NotFoundException("Course unit or prerequisite course unit not found.");
    }
    return saved;
  }

  /** Returns distinct active curriculum units for the supplied intake sequence. */
  getCourseUnitIdsForIntakeSlot(intakeSlot: number): Promise<string[]> {
    this.validateIntakeSlot(intakeSlot);
    return this.repository.listCourseUnitIdsForIntakeSlot(intakeSlot);
  }

  private async validateProgrammeSlot(programmeId: string, studyYear: number, intakeSlot: number) {
    const id = validateUuid(programmeId, "Programme ID");
    const programme = await this.programmesService.getProgramme(id);
    this.validateStudyYear(studyYear, programme.durationYears);
    this.validateIntakeSlot(intakeSlot);
    const department = await this.departmentsService.getDepartment(programme.departmentId);
    const faculty = await this.facultiesService.getFaculty(department.facultyId);
    return { ...programme, department: { ...department, faculty } };
  }

  private validateStudyYear(studyYear: number, durationYears: number): void {
    if (!Number.isSafeInteger(studyYear) || studyYear < 1 || studyYear > durationYears) {
      throw new BadRequestException(`Study year must be between 1 and ${durationYears}.`);
    }
  }

  private validateIntakeSlot(intakeSlot: number): void {
    if (!Number.isSafeInteger(intakeSlot) || intakeSlot < 1 || intakeSlot > 3) {
      throw new BadRequestException("Intake slot must be 1, 2, or 3.");
    }
  }

  private validatePlacementType(type: CurriculumCourseUnitInput["type"]): ProgrammeCourseUnitType {
    if (!Object.values(ProgrammeCourseUnitType).includes(type)) {
      throw new BadRequestException("The selected curriculum course-unit type is invalid.");
    }
    return type;
  }

  private hasCycle(edges: readonly PrerequisiteEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    for (const edge of edges) {
      const targets = adjacency.get(edge.courseUnitId) ?? [];
      targets.push(edge.prerequisiteId);
      adjacency.set(edge.courseUnitId, targets);
      indegree.set(edge.courseUnitId, indegree.get(edge.courseUnitId) ?? 0);
      indegree.set(edge.prerequisiteId, (indegree.get(edge.prerequisiteId) ?? 0) + 1);
    }

    const queue = [...indegree.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([courseUnitId]) => courseUnitId);
    let visited = 0;
    for (let index = 0; index < queue.length; index += 1) {
      const courseUnitId = queue[index];
      if (courseUnitId === undefined) {
        continue;
      }
      visited += 1;
      for (const prerequisiteId of adjacency.get(courseUnitId) ?? []) {
        const nextDegree = (indegree.get(prerequisiteId) ?? 0) - 1;
        indegree.set(prerequisiteId, nextDegree);
        if (nextDegree === 0) {
          queue.push(prerequisiteId);
        }
      }
    }
    return visited !== indegree.size;
  }
}
