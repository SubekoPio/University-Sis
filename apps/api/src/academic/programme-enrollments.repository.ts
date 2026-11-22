// Purpose: Persist programme enrollment history, lifecycle transitions, and progression.
import { Injectable } from "@nestjs/common";
import {
  IntakeRegistrationStatus,
  IntakeStatus,
  Prisma,
  ProgrammeEnrollmentStatus,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const enrollmentInclude = {
  programme: { select: { id: true, code: true, name: true, durationYears: true } },
  admissionIntake: {
    select: {
      id: true,
      sequence: true,
      academicYearId: true,
      academicYear: { select: { id: true, label: true } },
    },
  },
} satisfies Prisma.ProgrammeEnrollmentInclude;

/** Programme enrollment with its programme and admission-intake context. */
export type ProgrammeEnrollmentRecord = Prisma.ProgrammeEnrollmentGetPayload<{
  include: typeof enrollmentInclude;
}>;

/** Data required to validate a requested enrollment progression. */
export interface EnrollmentProgressionContext {
  enrollment: ProgrammeEnrollmentRecord;
  intake: { id: string; sequence: number; status: IntakeStatus; academicYearId: string };
  registrationStatus: IntakeRegistrationStatus | null;
  academicYearIds: string[];
}

/** Performs programme-enrollment persistence operations using Prisma. */
@Injectable()
export class ProgrammeEnrollmentsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists every current and historical enrollment for a student. */
  listForStudent(studentId: string): Promise<ProgrammeEnrollmentRecord[]> {
    return this.prisma.programmeEnrollment.findMany({
      where: { studentId },
      include: enrollmentInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  /** Finds an enrollment by ID. */
  findById(id: string): Promise<ProgrammeEnrollmentRecord | null> {
    return this.prisma.programmeEnrollment.findUnique({
      where: { id },
      include: enrollmentInclude,
    });
  }

  /** Finds the user who owns a student profile. */
  async findStudentOwner(studentId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    return student?.userId ?? null;
  }

  /** Returns the lifecycle status of an acting user. */
  async findUserStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status ?? null;
  }

  /** Changes enrollment status and writes its audit record in one transaction. */
  transitionStatus(input: {
    enrollmentId: string;
    expectedStatuses: ProgrammeEnrollmentStatus[];
    nextStatus: ProgrammeEnrollmentStatus;
    actorId: string;
    reason?: string;
  }): Promise<ProgrammeEnrollmentRecord | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.programmeEnrollment.findUnique({
          where: { id: input.enrollmentId },
          select: { id: true, studentId: true, status: true },
        });
        if (current === null || !input.expectedStatuses.includes(current.status)) {
          return null;
        }

        const updated = await transaction.programmeEnrollment.updateMany({
          where: {
            id: current.id,
            status: { in: input.expectedStatuses },
          },
          data: { status: input.nextStatus },
        });
        if (updated.count !== 1) {
          return null;
        }

        await transaction.auditLog.create({
          data: {
            actorId: input.actorId,
            action: "academic.enrollment.status_changed",
            resourceType: "programme_enrollment",
            resourceId: current.id,
            ...(input.reason === undefined ? {} : { reason: input.reason }),
            metadata: {
              studentId: current.studentId,
              from: current.status,
              to: input.nextStatus,
            },
          },
        });
        return transaction.programmeEnrollment.findUnique({
          where: { id: current.id },
          include: enrollmentInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Loads progression state, the completed intake, and chronological academic years. */
  async findProgressionContext(
    enrollmentId: string,
    intakeId: string,
  ): Promise<EnrollmentProgressionContext | null> {
    const [enrollment, intake] = await Promise.all([
      this.prisma.programmeEnrollment.findUnique({
        where: { id: enrollmentId },
        include: enrollmentInclude,
      }),
      this.prisma.intake.findFirst({
        where: { id: intakeId, deletedAt: null },
        select: { id: true, sequence: true, status: true, academicYearId: true },
      }),
    ]);
    if (enrollment === null || intake === null) {
      return null;
    }

    const [registration, academicYears] = await Promise.all([
      this.prisma.intakeRegistration.findUnique({
        where: { studentId_intakeId: { studentId: enrollment.studentId, intakeId } },
        select: { status: true },
      }),
      this.prisma.academicYear.findMany({
        select: { id: true },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      }),
    ]);
    return {
      enrollment,
      intake,
      registrationStatus: registration?.status ?? null,
      academicYearIds: academicYears.map(({ id }) => id),
    };
  }

  /** Completes a student's intake and advances its enrollment atomically. */
  async advanceAfterIntake(input: {
    enrollmentId: string;
    intakeId: string;
    currentStudyYear: number;
    currentIntakeSlot: number;
    nextStudyYear: number;
    nextIntakeSlot: number;
    nextStatus: ProgrammeEnrollmentStatus;
    actorId: string;
  }): Promise<ProgrammeEnrollmentRecord | null> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.programmeEnrollment.findUnique({
            where: { id: input.enrollmentId },
            select: { id: true, studentId: true, currentStudyYear: true, currentIntakeSlot: true },
          });
          const intake = await transaction.intake.findFirst({
            where: { id: input.intakeId, deletedAt: null },
            select: { id: true, status: true },
          });
          if (
            current === null ||
            intake === null ||
            current.currentStudyYear !== input.currentStudyYear ||
            current.currentIntakeSlot !== input.currentIntakeSlot ||
            intake.status !== IntakeStatus.CLOSED
          ) {
            return null;
          }

          const registrationUpdate = await transaction.intakeRegistration.updateMany({
            where: {
              studentId: current.studentId,
              intakeId: input.intakeId,
              status: IntakeRegistrationStatus.REGISTERED,
            },
            data: { status: IntakeRegistrationStatus.COMPLETED },
          });
          if (registrationUpdate.count !== 1) {
            return null;
          }

          const enrollmentUpdate = await transaction.programmeEnrollment.updateMany({
            where: {
              id: current.id,
              status: ProgrammeEnrollmentStatus.ACTIVE,
              currentStudyYear: input.currentStudyYear,
              currentIntakeSlot: input.currentIntakeSlot,
            },
            data: {
              currentStudyYear: input.nextStudyYear,
              currentIntakeSlot: input.nextIntakeSlot,
              status: input.nextStatus,
            },
          });
          if (enrollmentUpdate.count !== 1) {
            throw new StaleProgressionError();
          }

          await transaction.auditLog.create({
            data: {
              actorId: input.actorId,
              action: "academic.enrollment.progressed",
              resourceType: "programme_enrollment",
              resourceId: current.id,
              metadata: {
                intakeId: input.intakeId,
                from: {
                  currentStudyYear: input.currentStudyYear,
                  currentIntakeSlot: input.currentIntakeSlot,
                },
                to: {
                  currentStudyYear: input.nextStudyYear,
                  currentIntakeSlot: input.nextIntakeSlot,
                },
                status: input.nextStatus,
              },
            },
          });
          return transaction.programmeEnrollment.findUnique({
            where: { id: current.id },
            include: enrollmentInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (error instanceof StaleProgressionError) {
        return null;
      }
      throw error;
    }
  }
}

class StaleProgressionError extends Error {}
