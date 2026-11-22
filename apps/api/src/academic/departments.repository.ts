// Purpose: Persist departments and protect their faculty and programme relationships.
import { Injectable } from "@nestjs/common";
import type { Department } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { isPrismaRequestError } from "./academic.validation.js";
import type {
  CreateDepartmentInput,
  DepartmentListFilter,
  UpdateDepartmentInput,
} from "./academic.types.js";

/** Performs department persistence operations using Prisma. */
@Injectable()
export class DepartmentsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists active departments, optionally filtered by an active faculty. */
  list(filter: DepartmentListFilter): Promise<Department[]> {
    return this.prisma.department.findMany({
      where: {
        deletedAt: null,
        faculty: { is: { deletedAt: null } },
        ...(filter.facultyId === undefined ? {} : { facultyId: filter.facultyId }),
      },
      orderBy: { code: "asc" },
    });
  }

  /** Finds an active department whose faculty is also active. */
  findById(id: string): Promise<Department | null> {
    return this.prisma.department.findFirst({
      where: { id, deletedAt: null, faculty: { is: { deletedAt: null } } },
    });
  }

  /** Creates a department only when its faculty is active. */
  async create(input: CreateDepartmentInput): Promise<Department | null> {
    const faculty = await this.prisma.faculty.findFirst({
      where: { id: input.facultyId, deletedAt: null },
      select: { id: true },
    });
    if (faculty === null) {
      return null;
    }

    return this.prisma.department.create({
      data: {
        code: input.code,
        name: input.name,
        faculty: { connect: { id: faculty.id } },
      },
    });
  }

  /** Updates an active department, returning null if it or its new faculty is unavailable. */
  async update(id: string, input: UpdateDepartmentInput): Promise<Department | null> {
    if (input.facultyId !== undefined) {
      const faculty = await this.prisma.faculty.findFirst({
        where: { id: input.facultyId, deletedAt: null },
        select: { id: true },
      });
      if (faculty === null) {
        return null;
      }
    }

    const result = await this.prisma.department.updateMany({
      where: { id, deletedAt: null, faculty: { is: { deletedAt: null } } },
      data: input,
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Deletes an unreferenced department or soft-deletes it when history references it. */
  async delete(id: string, deletedAt: Date): Promise<boolean | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const department = await transaction.department.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            _count: {
              select: { programmes: true, courseUnits: true, lecturers: true },
            },
          },
        });
        if (department === null) {
          return null;
        }

        const isReferenced =
          department._count.programmes > 0 ||
          department._count.courseUnits > 0 ||
          department._count.lecturers > 0;
        if (isReferenced) {
          await transaction.department.update({
            where: { id },
            data: { deletedAt },
          });
        } else {
          await transaction.department.delete({ where: { id } });
        }

        return true;
      });
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2003")) {
        const archived = await this.prisma.department.updateMany({
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
