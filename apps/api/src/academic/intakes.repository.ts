// Purpose: Persist intake dates and status transitions without removing referenced history.
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Intake, IntakeStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { isPrismaRequestError } from "./academic.validation.js";
import type { UpdateIntakeInput } from "./academic.types.js";

/** An active intake with its active academic year. */
export type IntakeWithAcademicYear = Prisma.IntakeGetPayload<{
  include: { academicYear: true };
}>;

/** Performs intake persistence and compare-and-set status operations using Prisma. */
@Injectable()
export class IntakesRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists active intakes for an active academic year, or null if the year is unavailable. */
  async listForAcademicYear(academicYearId: string): Promise<Intake[] | null> {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, deletedAt: null },
      select: { id: true },
    });
    if (academicYear === null) {
      return null;
    }

    return this.prisma.intake.findMany({
      where: { academicYearId, deletedAt: null },
      orderBy: { sequence: "asc" },
    });
  }

  /** Lists all intake periods, including soft-deleted history, for an active year. */
  async listAllForAcademicYear(academicYearId: string): Promise<Intake[] | null> {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, deletedAt: null },
      select: { id: true },
    });
    if (academicYear === null) {
      return null;
    }

    return this.prisma.intake.findMany({
      where: { academicYearId },
      orderBy: { sequence: "asc" },
    });
  }

  /** Finds an active intake under an active academic year. */
  findById(id: string): Promise<IntakeWithAcademicYear | null> {
    return this.prisma.intake.findFirst({
      where: {
        id,
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
      },
      include: { academicYear: true },
    });
  }

  /** Updates intake dates or name without changing its lifecycle status. */
  async update(id: string, input: UpdateIntakeInput): Promise<IntakeWithAcademicYear | null> {
    const result = await this.prisma.intake.updateMany({
      where: {
        id,
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
      },
      data: input,
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Advances an intake only when its current state still matches the expected state. */
  async transitionStatus(
    id: string,
    currentStatus: IntakeStatus,
    nextStatus: IntakeStatus,
  ): Promise<IntakeWithAcademicYear | null> {
    const result = await this.prisma.intake.updateMany({
      where: {
        id,
        status: currentStatus,
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
      },
      data: { status: nextStatus },
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Deletes an unreferenced intake or soft-deletes it when history references it. */
  async delete(id: string, deletedAt: Date): Promise<boolean | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const intake = await transaction.intake.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            _count: {
              select: {
                courseUnitOfferings: true,
                programmeEnrollments: true,
                studentRegistrations: true,
                unitRegistrations: true,
                applications: true,
                admissionRecords: true,
              },
            },
          },
        });
        if (intake === null) {
          return null;
        }

        // Audience targets are stored as a type and ID, without a foreign key.
        const [announcementAudienceCount, calendarEventAudienceCount] = await Promise.all([
          transaction.announcementAudience.count({
            where: { audienceType: "INTAKE", targetId: id },
          }),
          transaction.calendarEventAudience.count({
            where: { audienceType: "INTAKE", targetId: id },
          }),
        ]);
        const references = intake._count;
        const isReferenced =
          references.courseUnitOfferings > 0 ||
          references.programmeEnrollments > 0 ||
          references.studentRegistrations > 0 ||
          references.unitRegistrations > 0 ||
          references.applications > 0 ||
          references.admissionRecords > 0 ||
          announcementAudienceCount > 0 ||
          calendarEventAudienceCount > 0;
        if (isReferenced) {
          await transaction.intake.update({
            where: { id },
            data: { deletedAt },
          });
        } else {
          await transaction.intake.delete({ where: { id } });
        }

        return true;
      });
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2003")) {
        const archived = await this.prisma.intake.updateMany({
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
