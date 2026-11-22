// Purpose: Persist course-unit catalogue records and faculty eligibility with Prisma.
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CourseUnitStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type {
  CourseUnitListFilter,
  CreateCourseUnitInput,
  UpdateCourseUnitInput,
} from "./academic-catalog.types.js";

const courseUnitInclude = {
  ownerDepartment: true,
  facultyEligibilities: { include: { faculty: true } },
} satisfies Prisma.CourseUnitInclude;

/** Course-unit record with its owning department and eligible faculties. */
export type CourseUnitDetails = Prisma.CourseUnitGetPayload<{
  include: typeof courseUnitInclude;
}>;

/** Normalized catalogue data accepted by course-unit persistence operations. */
export interface CourseUnitPersistenceInput {
  code: string;
  name: string;
  creditUnits: number;
  level: CreateCourseUnitInput["level"];
  ownerDepartmentId: string;
  status: CourseUnitStatus;
  isGeneral: boolean;
  openToAllFaculties: boolean;
  eligibleFacultyIds: string[];
}

/** General-unit state accepted by the eligibility replacement operation. */
export interface GeneralEligibilityPersistenceInput {
  isGeneral: boolean;
  openToAllFaculties: boolean;
  eligibleFacultyIds: string[];
}

/** Prisma repository for course-unit catalogue records. */
@Injectable()
export class CourseUnitsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists course units matching the supplied filters. */
  list(filter: CourseUnitListFilter): Promise<CourseUnitDetails[]> {
    return this.prisma.courseUnit.findMany({
      where: {
        ...(filter.search
          ? {
              OR: [
                { code: { contains: filter.search, mode: "insensitive" } },
                { name: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.level ? { level: filter.level } : {}),
        ...(filter.ownerDepartmentId ? { ownerDepartmentId: filter.ownerDepartmentId } : {}),
        ...(filter.isGeneral === undefined ? {} : { isGeneral: filter.isGeneral }),
        ownerDepartment: {
          is: {
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
        },
      },
      include: courseUnitInclude,
      orderBy: [{ code: "asc" }, { name: "asc" }],
    });
  }

  /** Finds one course unit whose owner department remains active. */
  findById(id: string): Promise<CourseUnitDetails | null> {
    return this.prisma.courseUnit.findFirst({
      where: {
        id,
        ownerDepartment: {
          is: {
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
        },
      },
      include: courseUnitInclude,
    });
  }

  /** Finds active-owner course units for the supplied identifiers. */
  findByIds(ids: string[]): Promise<CourseUnitDetails[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.courseUnit.findMany({
      where: {
        id: { in: ids },
        ownerDepartment: {
          is: {
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
        },
      },
      include: courseUnitInclude,
    });
  }

  /** Returns the subset of faculty identifiers that are not soft-deleted. */
  async findActiveFacultyIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const faculties = await this.prisma.faculty.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return faculties.map((faculty) => faculty.id);
  }

  /** Creates a course unit together with its initial faculty eligibility. */
  create(input: CourseUnitPersistenceInput): Promise<CourseUnitDetails | null> {
    return this.prisma.$transaction(async (transaction) => {
      const ownerDepartment = await transaction.department.findFirst({
        where: {
          id: input.ownerDepartmentId,
          deletedAt: null,
          faculty: { is: { deletedAt: null } },
        },
        select: { id: true },
      });
      if (!ownerDepartment) {
        return null;
      }

      const activeFaculties = await transaction.faculty.findMany({
        where: { id: { in: input.eligibleFacultyIds }, deletedAt: null },
        select: { id: true },
      });
      if (activeFaculties.length !== input.eligibleFacultyIds.length) {
        return null;
      }

      return transaction.courseUnit.create({
        data: {
          code: input.code,
          name: input.name,
          creditUnits: input.creditUnits,
          level: input.level,
          status: input.status,
          isGeneral: input.isGeneral,
          openToAllFaculties: input.openToAllFaculties,
          ownerDepartment: { connect: { id: ownerDepartment.id } },
          ...(input.eligibleFacultyIds.length > 0
            ? {
                facultyEligibilities: {
                  create: input.eligibleFacultyIds.map((facultyId) => ({
                    faculty: { connect: { id: facultyId } },
                  })),
                },
              }
            : {}),
        },
        include: courseUnitInclude,
      });
    });
  }

  /** Updates scalar course-unit fields and returns the expanded record. */
  async update(id: string, input: UpdateCourseUnitInput): Promise<CourseUnitDetails | null> {
    const data: Prisma.CourseUnitUpdateManyMutationInput = {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.creditUnits === undefined ? {} : { creditUnits: input.creditUnits }),
      ...(input.level === undefined ? {} : { level: input.level }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.ownerDepartmentId === undefined
        ? {}
        : { ownerDepartmentId: input.ownerDepartmentId }),
    };

    const result = await this.prisma.courseUnit.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findById(id);
  }

  /** Replaces a course unit's general flag and faculty eligibility atomically. */
  configureGeneralEligibility(
    id: string,
    input: GeneralEligibilityPersistenceInput,
  ): Promise<CourseUnitDetails | null> {
    return this.prisma.$transaction(async (transaction) => {
      const unit = await transaction.courseUnit.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!unit) {
        return null;
      }

      const activeFaculties = await transaction.faculty.findMany({
        where: { id: { in: input.eligibleFacultyIds }, deletedAt: null },
        select: { id: true },
      });
      if (activeFaculties.length !== input.eligibleFacultyIds.length) {
        return null;
      }

      await transaction.courseUnitFacultyEligibility.deleteMany({
        where: { courseUnitId: id },
      });
      await transaction.courseUnit.update({
        where: { id },
        data: {
          isGeneral: input.isGeneral,
          openToAllFaculties: input.openToAllFaculties,
        },
      });
      if (input.eligibleFacultyIds.length > 0) {
        await transaction.courseUnitFacultyEligibility.createMany({
          data: input.eligibleFacultyIds.map((facultyId) => ({
            courseUnitId: id,
            facultyId,
          })),
        });
      }

      return transaction.courseUnit.findUnique({
        where: { id },
        include: courseUnitInclude,
      });
    });
  }

  /** Deletes an unused unit or retires it when academic records reference it. */
  async deleteOrRetire(id: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const unit = await transaction.courseUnit.findUnique({
          where: { id },
          select: {
            id: true,
            _count: {
              select: {
                programmeCurriculumEntries: true,
                prerequisites: true,
                requiredBy: true,
                offerings: true,
              },
            },
          },
        });
        if (!unit) {
          return false;
        }

        const referenced =
          unit._count.programmeCurriculumEntries > 0 ||
          unit._count.prerequisites > 0 ||
          unit._count.requiredBy > 0 ||
          unit._count.offerings > 0;
        if (referenced) {
          await transaction.courseUnit.update({
            where: { id },
            data: { status: "RETIRED" },
          });
        } else {
          await transaction.courseUnit.delete({ where: { id } });
        }
        return true;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        const result = await this.prisma.courseUnit.updateMany({
          where: { id },
          data: { status: "RETIRED" },
        });
        return result.count > 0;
      }
      throw error;
    }
  }
}
