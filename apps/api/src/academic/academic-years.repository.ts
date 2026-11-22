// Purpose: Persist academic years and atomically create their configured intakes.
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AcademicYear, Intake } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { isPrismaRequestError } from "./academic.validation.js";
import type { CreateIntakeInput, UpdateAcademicYearInput } from "./academic.types.js";

const academicYearInclude = {
  intakes: {
    where: { deletedAt: null },
    orderBy: { sequence: "asc" },
  },
} satisfies Prisma.AcademicYearInclude;

/** An active academic year with its active intakes. */
export type AcademicYearWithIntakes = Prisma.AcademicYearGetPayload<{
  include: typeof academicYearInclude;
}>;

/** Performs academic-year persistence operations using Prisma. */
@Injectable()
export class AcademicYearsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists academic years that have not been soft-deleted. */
  list(): Promise<AcademicYear[]> {
    return this.prisma.academicYear.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: "desc" },
    });
  }

  /** Finds an active academic year and its active intakes. */
  findById(id: string): Promise<AcademicYearWithIntakes | null> {
    return this.prisma.academicYear.findFirst({
      where: { id, deletedAt: null },
      include: academicYearInclude,
    });
  }

  /** Finds every intake period, including soft-deleted history, for an active year. */
  async findAllIntakesByYear(id: string): Promise<Intake[] | null> {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (academicYear === null) {
      return null;
    }

    return this.prisma.intake.findMany({
      where: { academicYearId: id },
      orderBy: { sequence: "asc" },
    });
  }

  /** Creates an academic year and all three intakes in one database transaction. */
  createWithIntakes(
    input: {
      label: string;
      startDate: Date;
      endDate: Date;
    },
    intakes: readonly CreateIntakeInput[],
  ): Promise<AcademicYearWithIntakes> {
    return this.prisma.$transaction(async (transaction) => {
      const academicYear = await transaction.academicYear.create({
        data: input,
      });
      await transaction.intake.createMany({
        data: intakes.map((intake) => ({
          ...intake,
          academicYearId: academicYear.id,
          status: "UPCOMING",
        })),
      });

      return transaction.academicYear.findUniqueOrThrow({
        where: { id: academicYear.id },
        include: academicYearInclude,
      });
    });
  }

  /** Updates an active academic year and returns its active intakes. */
  async update(
    id: string,
    input: UpdateAcademicYearInput,
  ): Promise<AcademicYearWithIntakes | null> {
    const result = await this.prisma.academicYear.updateMany({
      where: { id, deletedAt: null },
      data: input,
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Deletes an unreferenced year or soft-deletes it when intake history exists. */
  async delete(id: string, deletedAt: Date): Promise<boolean | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const academicYear = await transaction.academicYear.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, _count: { select: { intakes: true } } },
        });
        if (academicYear === null) {
          return null;
        }

        if (academicYear._count.intakes > 0) {
          await transaction.academicYear.update({
            where: { id },
            data: { deletedAt },
          });
        } else {
          await transaction.academicYear.delete({ where: { id } });
        }

        return true;
      });
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2003")) {
        const archived = await this.prisma.academicYear.updateMany({
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
