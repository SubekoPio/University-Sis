// Purpose: Persist lecturer profiles and their department links with audit history.
import { Injectable } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateLecturerInput, LecturerListFilters, UpdateLecturerInput } from "./sis.types.js";

const lecturerProfileInclude = {
  user: { select: { id: true, name: true, email: true, status: true } },
  department: { select: { id: true, code: true, name: true } },
} satisfies Prisma.LecturerInclude;

/** Lecturer profile with safe account and department details. */
export type LecturerProfile = Prisma.LecturerGetPayload<{
  include: typeof lecturerProfileInclude;
}>;

/** Performs lecturer-profile persistence operations using Prisma. */
@Injectable()
export class LecturersRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists lecturer profiles, optionally scoped by department or search text. */
  list(filters: LecturerListFilters): Promise<LecturerProfile[]> {
    const search = filters.search?.trim();
    return this.prisma.lecturer.findMany({
      where: {
        ...(filters.departmentId === undefined ? {} : { departmentId: filters.departmentId }),
        ...(search
          ? {
              OR: [
                { staffNumber: { contains: search, mode: "insensitive" } },
                { user: { is: { name: { contains: search, mode: "insensitive" } } } },
                { user: { is: { email: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: lecturerProfileInclude,
      orderBy: [{ staffNumber: "asc" }, { id: "asc" }],
    });
  }

  /** Finds a lecturer profile by ID. */
  findById(id: string): Promise<LecturerProfile | null> {
    return this.prisma.lecturer.findUnique({
      where: { id },
      include: lecturerProfileInclude,
    });
  }

  /** Creates a lecturer profile only for an active account and active department. */
  async create(input: CreateLecturerInput, actorId: string): Promise<LecturerProfile | null> {
    return this.prisma.$transaction(async (transaction) => {
      const [user, department] = await Promise.all([
        transaction.user.findFirst({
          where: {
            id: input.userId,
            status: UserStatus.ACTIVE,
            studentProfile: { is: null },
            lecturerProfile: { is: null },
          },
          select: { id: true },
        }),
        transaction.department.findFirst({
          where: {
            id: input.departmentId,
            deletedAt: null,
            faculty: { is: { deletedAt: null } },
          },
          select: { id: true },
        }),
      ]);
      if (user === null || department === null) {
        return null;
      }

      const lecturer = await transaction.lecturer.create({
        data: {
          userId: user.id,
          departmentId: department.id,
          staffNumber: input.staffNumber,
        },
        include: lecturerProfileInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "academic.lecturer.created",
          resourceType: "lecturer",
          resourceId: lecturer.id,
          metadata: { departmentId: lecturer.departmentId, staffNumber: lecturer.staffNumber },
        },
      });
      return lecturer;
    });
  }

  /** Updates a lecturer's staff number or department and records the change. */
  async update(
    id: string,
    input: UpdateLecturerInput,
    actorId: string,
  ): Promise<LecturerProfile | null> {
    return this.prisma.$transaction(async (transaction) => {
      if (input.departmentId !== undefined) {
        const department = await transaction.department.findFirst({
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

      const updated = await transaction.lecturer.updateMany({
        where: { id },
        data: input,
      });
      if (updated.count === 0) {
        return null;
      }

      const lecturer = await transaction.lecturer.findUniqueOrThrow({
        where: { id },
        include: lecturerProfileInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "academic.lecturer.updated",
          resourceType: "lecturer",
          resourceId: lecturer.id,
          metadata: {
            ...(input.departmentId === undefined ? {} : { departmentId: input.departmentId }),
            ...(input.staffNumber === undefined ? {} : { staffNumber: lecturer.staffNumber }),
          },
        },
      });
      return lecturer;
    });
  }

  /** Returns the lifecycle status of an acting user. */
  async findUserStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status ?? null;
  }
}
