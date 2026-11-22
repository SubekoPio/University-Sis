// Purpose: Persist prompted course-unit data and atomic student selections.
import { Injectable } from "@nestjs/common";
import {
  IntakeStatus,
  Prisma,
  ProgrammeEnrollmentStatus,
  UnitRegistrationStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { UnitSelectionRegistration } from "./unit-selection.types.js";

const offeringInclude = {
  courseUnit: {
    select: {
      id: true,
      code: true,
      name: true,
      creditUnits: true,
      status: true,
      isGeneral: true,
      openToAllFaculties: true,
      ownerDepartment: { select: { facultyId: true } },
      facultyEligibilities: { select: { facultyId: true } },
      prerequisites: { select: { prerequisiteId: true } },
    },
  },
  lecturers: {
    where: { role: "PRIMARY" },
    orderBy: [{ createdAt: "asc" }],
    take: 1,
    select: {
      lecturer: {
        select: {
          id: true,
          staffNumber: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  },
  classSessions: {
    where: { status: { not: "CANCELLED" } },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      deliveryMode: true,
      room: true,
    },
  },
  timetableSlots: {
    select: { dayOfWeek: true, startTime: true, endTime: true },
  },
} satisfies Prisma.CourseUnitOfferingInclude;

/** Offering data needed for selection, without meeting URLs. */
export type UnitSelectionOfferingRecord = Prisma.CourseUnitOfferingGetPayload<{
  include: typeof offeringInclude;
}>;

/** Student context used by unit-selection validation inside a transaction. */
export interface UnitSelectionSnapshot {
  student: { id: string; userId: string; userStatus: string } | null;
  intake: {
    id: string;
    academicYearId: string;
    sequence: number;
    startDate: Date;
    selectionOpensAt: Date;
    selectionClosesAt: Date;
    status: IntakeStatus;
  } | null;
  activeEnrollments: Array<{
    id: string;
    programmeId: string;
    currentStudyYear: number;
    currentIntakeSlot: number;
    admissionAcademicYearId: string;
    programme: {
      deletedAt: Date | null;
      durationYears: number;
      department: {
        deletedAt: Date | null;
        facultyId: string;
        faculty: { deletedAt: Date | null };
      };
    };
  }>;
  academicYearIds: string[];
  curriculumEntries: Array<{
    courseUnitId: string;
    type: "CORE" | "ELECTIVE";
    courseUnit: {
      id: string;
      code: string;
      name: string;
      creditUnits: number;
      status: string;
      isGeneral: boolean;
      openToAllFaculties: boolean;
      ownerDepartment: { facultyId: string };
      facultyEligibilities: Array<{ facultyId: string }>;
      prerequisites: Array<{ prerequisiteId: string }>;
    };
  }>;
  electiveRules: Array<{ minCredits: number; maxCredits: number }>;
  offerings: UnitSelectionOfferingRecord[];
  registrations: Array<{
    id: string;
    studentId: string;
    offeringId: string;
    intakeId: string;
    status: UnitRegistrationStatus;
    isRetake: boolean;
    selectedAt: Date;
    offering: { courseUnitId: string };
  }>;
  completedUnitIds: string[];
  selectedCounts: Map<string, number>;
}

/** Runs pure selection-rule validation against a fresh transactional snapshot. */
export type UnitSelectionValidator = (snapshot: UnitSelectionSnapshot) => void;

/** Signals that a selection changed after its transactional snapshot was loaded. */
export class UnitSelectionWriteConflictError extends Error {}

/** Prisma repository for prompted course units and student registrations. */
@Injectable()
export class UnitSelectionsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Loads all prompt and validation data for one student and intake. */
  getSnapshot(studentId: string, intakeId: string): Promise<UnitSelectionSnapshot> {
    return this.loadSnapshot(this.prisma, studentId, intakeId, []);
  }

  /** Creates selected registrations after validation against transaction-fresh data. */
  selectUnits(
    input: {
      studentId: string;
      intakeId: string;
      offeringIds: string[];
      actorId: string;
      selectedAt: Date;
      overrideReason?: string;
    },
    validate: UnitSelectionValidator,
  ): Promise<UnitSelectionRegistration[]> {
    return this.prisma.$transaction(
      async (transaction) => {
        await this.lockActiveEnrollments(transaction, input.studentId);
        const existing = await transaction.unitRegistration.findMany({
          where: { studentId: input.studentId, intakeId: input.intakeId },
          select: { offeringId: true },
        });
        await this.lockOfferings(transaction, [
          ...input.offeringIds,
          ...existing.map(({ offeringId }) => offeringId),
        ]);

        const snapshot = await this.loadSnapshot(
          transaction,
          input.studentId,
          input.intakeId,
          input.offeringIds,
        );
        validate(snapshot);

        const existingByOffering = new Map(
          snapshot.registrations.map((registration) => [registration.offeringId, registration]),
        );
        const createIds: string[] = [];
        for (const offeringId of input.offeringIds) {
          const registration = existingByOffering.get(offeringId);
          if (registration?.status === UnitRegistrationStatus.DROPPED) {
            const updated = await transaction.unitRegistration.updateMany({
              where: {
                id: registration.id,
                status: UnitRegistrationStatus.DROPPED,
              },
              data: {
                status: UnitRegistrationStatus.SELECTED,
                isRetake: false,
                selectedAt: input.selectedAt,
              },
            });
            if (updated.count !== 1) {
              throw new UnitSelectionWriteConflictError();
            }
          } else if (registration === undefined) {
            createIds.push(offeringId);
          }
        }

        if (createIds.length > 0) {
          await transaction.unitRegistration.createMany({
            data: createIds.map((offeringId) => ({
              studentId: input.studentId,
              offeringId,
              intakeId: input.intakeId,
              status: UnitRegistrationStatus.SELECTED,
              isRetake: false,
              selectedAt: input.selectedAt,
            })),
          });
        }

        if (input.overrideReason !== undefined) {
          await transaction.auditLog.create({
            data: {
              actorId: input.actorId,
              action: "academic.unit_selection.overridden",
              resourceType: "student_intake_unit_selection",
              resourceId: input.studentId,
              reason: input.overrideReason,
              metadata: {
                intakeId: input.intakeId,
                offeringIds: input.offeringIds,
                bypassed: ["selection_window"],
              },
            },
          });
        }

        return transaction.unitRegistration.findMany({
          where: {
            studentId: input.studentId,
            intakeId: input.intakeId,
            status: UnitRegistrationStatus.SELECTED,
          },
          orderBy: [{ selectedAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            studentId: true,
            offeringId: true,
            intakeId: true,
            status: true,
            isRetake: true,
            selectedAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Drops one selection without deleting its registration history. */
  dropUnit(
    input: {
      studentId: string;
      intakeId: string;
      offeringId: string;
    },
    validate: UnitSelectionValidator,
  ): Promise<UnitSelectionRegistration | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        await this.lockActiveEnrollments(transaction, input.studentId);
        await this.lockOfferings(transaction, [input.offeringId]);
        const snapshot = await this.loadSnapshot(transaction, input.studentId, input.intakeId, [
          input.offeringId,
        ]);
        validate(snapshot);

        const registration = snapshot.registrations.find(
          (item) =>
            item.offeringId === input.offeringId && item.status === UnitRegistrationStatus.SELECTED,
        );
        if (registration === undefined) {
          return null;
        }
        const updated = await transaction.unitRegistration.updateMany({
          where: {
            id: registration.id,
            status: UnitRegistrationStatus.SELECTED,
          },
          data: { status: UnitRegistrationStatus.DROPPED },
        });
        if (updated.count !== 1) {
          throw new UnitSelectionWriteConflictError();
        }

        return transaction.unitRegistration.findUnique({
          where: { id: registration.id },
          select: {
            id: true,
            studentId: true,
            offeringId: true,
            intakeId: true,
            status: true,
            isRetake: true,
            selectedAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Returns the current status of an authenticated user. */
  async findUserStatus(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status ?? null;
  }

  private async loadSnapshot(
    client: Prisma.TransactionClient | PrismaService,
    studentId: string,
    intakeId: string,
    requestedOfferingIds: string[],
  ): Promise<UnitSelectionSnapshot> {
    const [student, intake, activeEnrollments, academicYears] = await Promise.all([
      client.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          userId: true,
          user: { select: { status: true } },
        },
      }),
      client.intake.findFirst({
        where: {
          id: intakeId,
          deletedAt: null,
          academicYear: { is: { deletedAt: null } },
        },
        select: {
          id: true,
          academicYearId: true,
          sequence: true,
          startDate: true,
          selectionOpensAt: true,
          selectionClosesAt: true,
          status: true,
        },
      }),
      client.programmeEnrollment.findMany({
        where: {
          studentId,
          status: ProgrammeEnrollmentStatus.ACTIVE,
        },
        select: {
          id: true,
          programmeId: true,
          currentStudyYear: true,
          currentIntakeSlot: true,
          admissionIntake: { select: { academicYearId: true } },
          programme: {
            select: {
              deletedAt: true,
              durationYears: true,
              department: {
                select: {
                  deletedAt: true,
                  facultyId: true,
                  faculty: { select: { deletedAt: true } },
                },
              },
            },
          },
        },
      }),
      client.academicYear.findMany({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      }),
    ]);

    const enrollment = activeEnrollments.length === 1 ? activeEnrollments[0] : undefined;
    const currentEntries =
      enrollment === undefined
        ? []
        : await client.programmeCourseUnit.findMany({
            where: {
              programmeId: enrollment.programmeId,
              studyYear: enrollment.currentStudyYear,
              intakeSlot: enrollment.currentIntakeSlot,
            },
            select: {
              courseUnitId: true,
              type: true,
              courseUnit: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  creditUnits: true,
                  status: true,
                  isGeneral: true,
                  openToAllFaculties: true,
                  ownerDepartment: { select: { facultyId: true } },
                  facultyEligibilities: { select: { facultyId: true } },
                  prerequisites: { select: { prerequisiteId: true } },
                },
              },
            },
          });
    const electiveRules =
      enrollment === undefined
        ? []
        : await client.programmeElectiveRule.findMany({
            where: {
              programmeId: enrollment.programmeId,
              studyYear: enrollment.currentStudyYear,
              intakeSlot: enrollment.currentIntakeSlot,
            },
            select: { minCredits: true, maxCredits: true },
            orderBy: [{ minCredits: "asc" }, { maxCredits: "asc" }],
          });
    const registrations = await client.unitRegistration.findMany({
      where: { studentId, intakeId },
      select: {
        id: true,
        studentId: true,
        offeringId: true,
        intakeId: true,
        status: true,
        isRetake: true,
        selectedAt: true,
        offering: { select: { courseUnitId: true } },
      },
    });

    const curriculumIds = currentEntries.map(({ courseUnitId }) => courseUnitId);
    const registrationOfferingIds = registrations.map(({ offeringId }) => offeringId);
    const courseUnitFilters: Prisma.CourseUnitOfferingWhereInput[] = [
      { id: { in: [...requestedOfferingIds, ...registrationOfferingIds] } },
      {
        courseUnit: {
          is: {
            status: "ACTIVE",
            OR: [
              { programmeCurriculumEntries: { some: { courseUnitId: { in: curriculumIds } } } },
              { isGeneral: true },
            ],
          },
        },
      },
    ];
    const offerings =
      intake === null
        ? []
        : await client.courseUnitOffering.findMany({
            where: {
              intakeId,
              OR: courseUnitFilters,
            },
            include: offeringInclude,
            orderBy: [{ courseUnit: { code: "asc" } }],
          });

    const offeringIds = offerings.map(({ id }) => id);
    const [completedRegistrations, selectedCounts] =
      intake === null || offeringIds.length === 0
        ? ([[], []] as const)
        : await Promise.all([
            client.unitRegistration.findMany({
              where: {
                studentId,
                status: UnitRegistrationStatus.COMPLETED,
                intake: { is: { endDate: { lt: intake.startDate }, deletedAt: null } },
              },
              select: { offering: { select: { courseUnitId: true } } },
            }),
            client.unitRegistration.groupBy({
              by: ["offeringId"],
              where: {
                offeringId: { in: offeringIds },
                status: UnitRegistrationStatus.SELECTED,
              },
              _count: { _all: true },
            }),
          ]);

    return {
      student:
        student === null
          ? null
          : { id: student.id, userId: student.userId, userStatus: student.user.status },
      intake,
      activeEnrollments: activeEnrollments.map((item) => ({
        id: item.id,
        programmeId: item.programmeId,
        currentStudyYear: item.currentStudyYear,
        currentIntakeSlot: item.currentIntakeSlot,
        admissionAcademicYearId: item.admissionIntake.academicYearId,
        programme: item.programme,
      })),
      academicYearIds: academicYears.map(({ id }) => id),
      curriculumEntries: currentEntries,
      electiveRules,
      offerings,
      registrations,
      completedUnitIds: completedRegistrations.map(({ offering }) => offering.courseUnitId),
      selectedCounts: new Map(
        selectedCounts.map(({ offeringId, _count }) => [offeringId, _count._all]),
      ),
    };
  }

  private async lockActiveEnrollments(
    transaction: Prisma.TransactionClient,
    studentId: string,
  ): Promise<void> {
    // Serialize a student's intake selection, including elective-load changes across offerings.
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "ProgrammeEnrollment"
      WHERE "studentId" = ${studentId}::uuid
        AND "status" = 'ACTIVE'
      ORDER BY "id"
      FOR UPDATE
    `;
  }

  private async lockOfferings(
    transaction: Prisma.TransactionClient,
    offeringIds: string[],
  ): Promise<void> {
    for (const offeringId of [...new Set(offeringIds)].sort()) {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "CourseUnitOffering"
        WHERE "id" = ${offeringId}::uuid
        FOR UPDATE
      `;
    }
  }
}
