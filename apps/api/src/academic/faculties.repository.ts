// Purpose: Persist faculty records and preserve referenced academic history.
import { Injectable } from "@nestjs/common";
import type { Faculty } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { isPrismaRequestError } from "./academic.validation.js";
import type { CreateFacultyInput, UpdateFacultyInput } from "./academic.types.js";

/** Performs faculty persistence operations using Prisma. */
@Injectable()
export class FacultiesRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists faculties that have not been soft-deleted. */
  list(): Promise<Faculty[]> {
    return this.prisma.faculty.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
    });
  }

  /** Finds an active faculty by ID. */
  findById(id: string): Promise<Faculty | null> {
    return this.prisma.faculty.findFirst({ where: { id, deletedAt: null } });
  }

  /** Creates a faculty. */
  create(input: CreateFacultyInput): Promise<Faculty> {
    return this.prisma.faculty.create({ data: input });
  }

  /** Updates an active faculty and returns null if it is missing or deleted. */
  async update(id: string, input: UpdateFacultyInput): Promise<Faculty | null> {
    const result = await this.prisma.faculty.updateMany({
      where: { id, deletedAt: null },
      data: input,
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Deletes an unreferenced faculty or soft-deletes it when history references it. */
  async delete(id: string, deletedAt: Date): Promise<boolean | null> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const faculty = await transaction.faculty.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            _count: {
              select: { departments: true, courseUnitEligibilities: true },
            },
          },
        });
        if (faculty === null) {
          return null;
        }

        // Audience targets are stored as a type and ID, without a foreign key.
        const [announcementAudienceCount, calendarEventAudienceCount] = await Promise.all([
          transaction.announcementAudience.count({
            where: { audienceType: "FACULTY", targetId: id },
          }),
          transaction.calendarEventAudience.count({
            where: { audienceType: "FACULTY", targetId: id },
          }),
        ]);
        const isReferenced =
          faculty._count.departments > 0 ||
          faculty._count.courseUnitEligibilities > 0 ||
          announcementAudienceCount > 0 ||
          calendarEventAudienceCount > 0;
        if (isReferenced) {
          await transaction.faculty.update({
            where: { id },
            data: { deletedAt },
          });
        } else {
          await transaction.faculty.delete({ where: { id } });
        }

        return true;
      });
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2003")) {
        const archived = await this.prisma.faculty.updateMany({
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
