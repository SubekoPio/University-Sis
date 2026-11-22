// Purpose: Persist programme curriculum placements, elective rules, and prerequisites.
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type {
  CurriculumCourseUnitInput,
  ElectiveCreditRuleInput,
} from "./academic-catalog.types.js";

const curriculumEntryInclude = {
  courseUnit: true,
} satisfies Prisma.ProgrammeCourseUnitInclude;

/** Curriculum placement with its full course-unit record. */
export type CurriculumEntry = Prisma.ProgrammeCourseUnitGetPayload<{
  include: typeof curriculumEntryInclude;
}>;

/** One directed course-unit prerequisite relation. */
export interface PrerequisiteEdge {
  courseUnitId: string;
  prerequisiteId: string;
}

/** Prisma repository for curriculum, elective rules, and prerequisites. */
@Injectable()
export class CurriculumRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists the curriculum placements for one programme slot. */
  listCourseUnits(
    programmeId: string,
    studyYear: number,
    intakeSlot: number,
  ): Promise<CurriculumEntry[]> {
    return this.prisma.programmeCourseUnit.findMany({
      where: { programmeId, studyYear, intakeSlot },
      include: curriculumEntryInclude,
      orderBy: [{ type: "asc" }, { courseUnit: { code: "asc" } }],
    });
  }

  /** Replaces one programme slot's placements in a single transaction. */
  replaceCourseUnits(
    programmeId: string,
    studyYear: number,
    intakeSlot: number,
    placements: CurriculumCourseUnitInput[],
  ): Promise<CurriculumEntry[] | null> {
    return this.prisma.$transaction(async (transaction) => {
      const programme = await transaction.programme.findFirst({
        where: {
          id: programmeId,
          deletedAt: null,
          department: {
            is: {
              deletedAt: null,
              faculty: { is: { deletedAt: null } },
            },
          },
        },
        select: { id: true },
      });
      if (!programme) {
        return null;
      }

      await transaction.programmeCourseUnit.deleteMany({
        where: { programmeId, studyYear, intakeSlot },
      });
      if (placements.length > 0) {
        await transaction.programmeCourseUnit.createMany({
          data: placements.map((placement) => ({
            programmeId,
            studyYear,
            intakeSlot,
            courseUnitId: placement.courseUnitId,
            type: placement.type,
          })),
        });
      }

      return transaction.programmeCourseUnit.findMany({
        where: { programmeId, studyYear, intakeSlot },
        include: curriculumEntryInclude,
        orderBy: [{ type: "asc" }, { courseUnit: { code: "asc" } }],
      });
    });
  }

  /** Lists elective-credit rules for one programme slot. */
  listElectiveRules(programmeId: string, studyYear: number, intakeSlot: number) {
    return this.prisma.programmeElectiveRule.findMany({
      where: { programmeId, studyYear, intakeSlot },
      orderBy: [{ minCredits: "asc" }, { maxCredits: "asc" }],
    });
  }

  /** Replaces the elective-credit rules for one programme slot atomically. */
  replaceElectiveRules(
    programmeId: string,
    studyYear: number,
    intakeSlot: number,
    rules: ElectiveCreditRuleInput[],
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const programme = await transaction.programme.findFirst({
        where: {
          id: programmeId,
          deletedAt: null,
          department: {
            is: {
              deletedAt: null,
              faculty: { is: { deletedAt: null } },
            },
          },
        },
        select: { id: true },
      });
      if (!programme) {
        return null;
      }

      await transaction.programmeElectiveRule.deleteMany({
        where: { programmeId, studyYear, intakeSlot },
      });
      if (rules.length > 0) {
        await transaction.programmeElectiveRule.createMany({
          data: rules.map((rule) => ({
            programmeId,
            studyYear,
            intakeSlot,
            minCredits: rule.minCredits,
            maxCredits: rule.maxCredits,
          })),
        });
      }

      return transaction.programmeElectiveRule.findMany({
        where: { programmeId, studyYear, intakeSlot },
        orderBy: [{ minCredits: "asc" }, { maxCredits: "asc" }],
      });
    });
  }

  /** Lists all prerequisite edges for cycle validation. */
  listPrerequisiteEdges(): Promise<PrerequisiteEdge[]> {
    return this.prisma.courseUnitPrerequisite.findMany({
      select: { courseUnitId: true, prerequisiteId: true },
    });
  }

  /** Lists prerequisites currently configured for a course unit. */
  listPrerequisites(courseUnitId: string) {
    return this.prisma.courseUnitPrerequisite.findMany({
      where: { courseUnitId },
      orderBy: { prerequisiteId: "asc" },
    });
  }

  /** Replaces one unit's prerequisite set when all related units remain active. */
  replacePrerequisites(
    courseUnitId: string,
    prerequisiteIds: string[],
  ): Promise<PrerequisiteEdge[] | null> {
    return this.prisma.$transaction(async (transaction) => {
      const unitIds = [courseUnitId, ...prerequisiteIds];
      const units = await transaction.courseUnit.findMany({
        where: {
          id: { in: unitIds },
          status: "ACTIVE",
          ownerDepartment: {
            is: {
              deletedAt: null,
              faculty: { is: { deletedAt: null } },
            },
          },
        },
        select: { id: true },
      });
      if (units.length !== new Set(unitIds).size) {
        return null;
      }

      await transaction.courseUnitPrerequisite.deleteMany({
        where: { courseUnitId },
      });
      if (prerequisiteIds.length > 0) {
        await transaction.courseUnitPrerequisite.createMany({
          data: prerequisiteIds.map((prerequisiteId) => ({
            courseUnitId,
            prerequisiteId,
          })),
        });
      }
      return transaction.courseUnitPrerequisite.findMany({
        where: { courseUnitId },
        orderBy: { prerequisiteId: "asc" },
      });
    });
  }

  /** Returns distinct active curriculum units for an intake's sequence slot. */
  async listCourseUnitIdsForIntakeSlot(intakeSlot: number): Promise<string[]> {
    const placements = await this.prisma.programmeCourseUnit.findMany({
      where: {
        intakeSlot,
        programme: {
          is: {
            deletedAt: null,
            department: {
              is: {
                deletedAt: null,
                faculty: { is: { deletedAt: null } },
              },
            },
          },
        },
        courseUnit: {
          is: {
            status: "ACTIVE",
            ownerDepartment: {
              is: {
                deletedAt: null,
                faculty: { is: { deletedAt: null } },
              },
            },
          },
        },
      },
      select: { courseUnitId: true },
    });
    return [...new Set(placements.map((placement) => placement.courseUnitId))];
  }
}
