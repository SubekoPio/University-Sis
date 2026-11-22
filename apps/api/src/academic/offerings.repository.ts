// Purpose: Persist shared course-unit offerings and lecturer assignments with Prisma.
import { Injectable } from "@nestjs/common";
import type { OfferingLecturer, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type {
  AssignOfferingLecturerInput,
  BulkCreateOfferingsInput,
  CreateOfferingInput,
} from "./academic-catalog.types.js";

const offeringInclude = {
  courseUnit: true,
  lecturers: { include: { lecturer: true } },
} satisfies Prisma.CourseUnitOfferingInclude;

/** Offering record with its course unit and assigned lecturer profiles. */
export type OfferingDetails = Prisma.CourseUnitOfferingGetPayload<{
  include: typeof offeringInclude;
}>;

/** Result of an atomic lecturer assignment attempt. */
export type AssignLecturerResult =
  | {
      kind: "assigned";
      assignment: OfferingLecturer;
    }
  | { kind: "offering-not-found" }
  | { kind: "lecturer-not-found" }
  | { kind: "primary-already-assigned" };

/** Result of replacing one lecturer assignment with another. */
export type ReplaceLecturerResult =
  | {
      kind: "replaced";
      assignment: OfferingLecturer;
    }
  | { kind: "assignment-not-found" }
  | { kind: "lecturer-not-found" }
  | { kind: "lecturer-already-assigned" };

/** Result of copying lecturer assignments and offerings from the prior intake. */
export type CopyOfferingsResult =
  | { kind: "target-not-found" }
  | { kind: "previous-intake-not-found" }
  | { kind: "duplicate-offerings" }
  | { kind: "copied"; offerings: OfferingDetails[] };

/** Prisma repository for course-unit offerings and lecturer assignments. */
@Injectable()
export class OfferingsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists offerings for one intake, ordered by course-unit code. */
  listForIntake(intakeId: string): Promise<OfferingDetails[]> {
    return this.prisma.courseUnitOffering.findMany({
      where: { intakeId },
      include: offeringInclude,
      orderBy: [{ courseUnit: { code: "asc" } }],
    });
  }

  /** Finds an offering by its identifier. */
  findById(id: string): Promise<OfferingDetails | null> {
    return this.prisma.courseUnitOffering.findUnique({
      where: { id },
      include: offeringInclude,
    });
  }

  /** Creates one planned offering. */
  create(input: CreateOfferingInput): Promise<OfferingDetails> {
    return this.prisma.courseUnitOffering.create({
      data: {
        courseUnitId: input.courseUnitId,
        intakeId: input.intakeId,
        deliveryMode: input.deliveryMode,
        capacity: input.capacity ?? null,
        status: "PLANNED",
      },
      include: offeringInclude,
    });
  }

  /** Lists unit identifiers already offered in the destination intake. */
  async findExistingUnitIds(intakeId: string, courseUnitIds: string[]): Promise<string[]> {
    if (courseUnitIds.length === 0) {
      return [];
    }

    const offerings = await this.prisma.courseUnitOffering.findMany({
      where: { intakeId, courseUnitId: { in: courseUnitIds } },
      select: { courseUnitId: true },
    });
    return offerings.map((offering) => offering.courseUnitId);
  }

  /** Bulk-creates offerings and returns the persisted records. */
  bulkCreate(
    intakeId: string,
    courseUnitIds: string[],
    input: BulkCreateOfferingsInput,
  ): Promise<OfferingDetails[]> {
    if (courseUnitIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.courseUnitOffering.createMany({
        data: courseUnitIds.map((courseUnitId) => ({
          courseUnitId,
          intakeId,
          deliveryMode: input.deliveryMode,
          capacity: input.capacity ?? null,
          status: "PLANNED",
        })),
      });
      return transaction.courseUnitOffering.findMany({
        where: { intakeId, courseUnitId: { in: courseUnitIds } },
        include: offeringInclude,
        orderBy: [{ courseUnit: { code: "asc" } }],
      });
    });
  }

  /** Updates an offering's nullable capacity. */
  async updateCapacity(id: string, capacity: number | null): Promise<OfferingDetails | null> {
    const result = await this.prisma.courseUnitOffering.updateMany({
      where: { id },
      data: { capacity },
    });
    return result.count === 0 ? null : this.findById(id);
  }

  /** Copies the previous intake's offerings and lecturer roles atomically. */
  copyFromPreviousIntake(intakeId: string): Promise<CopyOfferingsResult> {
    return this.prisma.$transaction(async (transaction) => {
      const target = await transaction.intake.findFirst({
        where: {
          id: intakeId,
          deletedAt: null,
          academicYear: { is: { deletedAt: null } },
        },
        select: { id: true, startDate: true },
      });
      if (!target) {
        return { kind: "target-not-found" };
      }

      const previousIntake = await transaction.intake.findFirst({
        where: {
          id: { not: target.id },
          deletedAt: null,
          endDate: { lt: target.startDate },
          academicYear: { is: { deletedAt: null } },
        },
        include: {
          courseUnitOfferings: {
            include: { lecturers: true },
          },
        },
        orderBy: [{ endDate: "desc" }, { sequence: "desc" }],
      });
      if (!previousIntake) {
        return { kind: "previous-intake-not-found" };
      }

      const courseUnitIds = previousIntake.courseUnitOfferings.map(
        (offering) => offering.courseUnitId,
      );
      if (courseUnitIds.length === 0) {
        return { kind: "copied", offerings: [] };
      }

      const existing = await transaction.courseUnitOffering.findMany({
        where: {
          intakeId: target.id,
          courseUnitId: { in: courseUnitIds },
        },
        select: { courseUnitId: true },
      });
      if (existing.length > 0) {
        return { kind: "duplicate-offerings" };
      }

      const offerings: OfferingDetails[] = [];
      for (const source of previousIntake.courseUnitOfferings) {
        const created = await transaction.courseUnitOffering.create({
          data: {
            courseUnitId: source.courseUnitId,
            intakeId: target.id,
            capacity: source.capacity,
            deliveryMode: source.deliveryMode,
            // Copied offerings are set up for the new intake, not left open from the previous one.
            status: "PLANNED",
            ...(source.lecturers.length > 0
              ? {
                  lecturers: {
                    create: source.lecturers.map((assignment) => ({
                      role: assignment.role,
                      lecturer: { connect: { id: assignment.lecturerId } },
                    })),
                  },
                }
              : {}),
          },
          include: offeringInclude,
        });
        offerings.push(created);
      }

      return { kind: "copied", offerings };
    });
  }

  /** Creates a lecturer assignment while checking offering and lecturer state. */
  assignLecturer(
    offeringId: string,
    input: AssignOfferingLecturerInput,
  ): Promise<AssignLecturerResult> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOffering(transaction, offeringId);
      const offering = await transaction.courseUnitOffering.findUnique({
        where: { id: offeringId },
        select: { id: true },
      });
      if (!offering) {
        return { kind: "offering-not-found" };
      }

      const lecturer = await transaction.lecturer.findFirst({
        where: {
          id: input.lecturerId,
          user: { is: { status: "ACTIVE" } },
          department: {
            is: {
              deletedAt: null,
              faculty: { is: { deletedAt: null } },
            },
          },
        },
        select: { id: true },
      });
      if (!lecturer) {
        return { kind: "lecturer-not-found" };
      }

      if (input.role === "PRIMARY") {
        const primary = await transaction.offeringLecturer.findFirst({
          where: { offeringId, role: "PRIMARY" },
          select: { lecturerId: true },
        });
        if (primary) {
          return { kind: "primary-already-assigned" };
        }
      }

      const assignment = await transaction.offeringLecturer.create({
        data: {
          offeringId,
          lecturerId: lecturer.id,
          role: input.role,
        },
      });
      return { kind: "assigned", assignment };
    });
  }

  /** Replaces an assignment without changing its PRIMARY or ASSISTANT role. */
  replaceLecturer(
    offeringId: string,
    currentLecturerId: string,
    replacementLecturerId: string,
  ): Promise<ReplaceLecturerResult> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOffering(transaction, offeringId);
      const current = await transaction.offeringLecturer.findUnique({
        where: {
          offeringId_lecturerId: {
            offeringId,
            lecturerId: currentLecturerId,
          },
        },
      });
      if (!current) {
        return { kind: "assignment-not-found" };
      }

      const lecturer = await transaction.lecturer.findFirst({
        where: {
          id: replacementLecturerId,
          user: { is: { status: "ACTIVE" } },
          department: {
            is: {
              deletedAt: null,
              faculty: { is: { deletedAt: null } },
            },
          },
        },
        select: { id: true },
      });
      if (!lecturer) {
        return { kind: "lecturer-not-found" };
      }

      const existing = await transaction.offeringLecturer.findUnique({
        where: {
          offeringId_lecturerId: {
            offeringId,
            lecturerId: replacementLecturerId,
          },
        },
        select: { lecturerId: true },
      });
      if (existing) {
        return { kind: "lecturer-already-assigned" };
      }

      await transaction.offeringLecturer.delete({
        where: {
          offeringId_lecturerId: {
            offeringId,
            lecturerId: currentLecturerId,
          },
        },
      });
      const assignment = await transaction.offeringLecturer.create({
        data: {
          offeringId,
          lecturerId: replacementLecturerId,
          role: current.role,
        },
      });
      return { kind: "replaced", assignment };
    });
  }

  /** Removes one lecturer assignment and reports whether it existed. */
  async removeLecturer(offeringId: string, lecturerId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOffering(transaction, offeringId);
      const result = await transaction.offeringLecturer.deleteMany({
        where: { offeringId, lecturerId },
      });
      return result.count > 0;
    });
  }

  private async lockOffering(
    transaction: Prisma.TransactionClient,
    offeringId: string,
  ): Promise<void> {
    // Serialize assignment changes because the schema has no partial unique primary-role constraint.
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "CourseUnitOffering"
      WHERE "id" = ${offeringId}::uuid
      FOR UPDATE
    `;
  }
}
