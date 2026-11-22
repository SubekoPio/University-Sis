// Purpose: Persist programmes while preserving related curriculum and enrollment history.
import { Injectable } from "@nestjs/common";
import type { Programme } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { isPrismaRequestError } from "./academic.validation.js";
import type {
  CreateProgrammeInput,
  ProgrammeListFilter,
  UpdateProgrammeInput,
} from "./academic.types.js";

/** Performs programme persistence operations using Prisma. */
@Injectable()
export class ProgrammesRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists active programmes, optionally filtered by an active department. */
  list(filter: ProgrammeListFilter): Promise<Programme[]> {
    return this.prisma.programme.findMany({
      where: {
        deletedAt: null,
        department: {
          is: {
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
        },
        ...(filter.departmentId === undefined ? {} : { departmentId: filter.departmentId }),
      },
      orderBy: { code: "asc" },
    });
  }

  /** Finds an active programme whose department and faculty are active. */
  findById(id: string): Promise<Programme | null> {
    return this.prisma.programme.findFirst({
      where: {
        id,
        deletedAt: null,
        department: {
          is: {
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
        },
      },
    });
  }

  /** Creates a programme only when its department and faculty are active. */
  async create(input: CreateProgrammeInput): Promise<Programme | null> {
    const department = await this.prisma.department.findFirst({
      where: {
        id: input.departmentId,
        deletedAt: null,
        faculty: { is: { deletedAt: null } },
      },
      select: { id: true },
    });
    if (department === null) {
      return null;
    }

    return this.prisma.programme.create({
      data: {
        code: input.code,
        name: input.name,
        awardLevel: input.awardLevel,
        durationYears: input.durationYears,
        department: { connect: { id: department.id } },
      },
    });
  }

  /** Updates an active programme, returning null if it or its parent is unavailable. */
  async update(id: string, input: UpdateProgrammeInput): Promise<Programme | null> {
    if (input.departmentId !== undefined) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: input.departmentId,
          deletedAt: null,
          faculty: { is: { deletedAt: null } },
        },
        select: { id: true },
      });
      if (department === null) {
        return null;
      }
    }

    const result = await this.prisma.programme.updateMany({
      where: {
        id,
        deletedAt: null,
        department: {
          is: {
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
        },
      },
      data: input,
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Deletes an unreferenced programme or soft-deletes it when history references it. */
  async delete(id: string, deletedAt: Date): Promise<boolean | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const programme = await transaction.programme.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            _count: {
              select: {
                courseUnitCurriculumEntries: true,
                electiveRules: true,
                enrollments: true,
                applications: true,
                admissionRecords: true,
              },
            },
          },
        });
        if (programme === null) {
          return null;
        }

        // Audience targets are stored as a type and ID, without a foreign key.
        const [announcementAudienceCount, calendarEventAudienceCount] = await Promise.all([
          transaction.announcementAudience.count({
            where: { audienceType: "PROGRAMME", targetId: id },
          }),
          transaction.calendarEventAudience.count({
            where: { audienceType: "PROGRAMME", targetId: id },
          }),
        ]);
        const references = programme._count;
        const isReferenced =
          references.courseUnitCurriculumEntries > 0 ||
          references.electiveRules > 0 ||
          references.enrollments > 0 ||
          references.applications > 0 ||
          references.admissionRecords > 0 ||
          announcementAudienceCount > 0 ||
          calendarEventAudienceCount > 0;
        if (isReferenced) {
          await transaction.programme.update({
            where: { id },
            data: { deletedAt },
          });
        } else {
          await transaction.programme.delete({ where: { id } });
        }

        return true;
      });
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2003")) {
        const archived = await this.prisma.programme.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt },
        });
        return archived.count === 0 ? null : true;
      }
      if (isPrismaRequestError(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }
}
