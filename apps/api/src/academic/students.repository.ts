// Purpose: Persist student profiles, admission-linked creation, and audited status changes.
import { Injectable } from "@nestjs/common";
import { ApplicationStatus, Prisma, StudyMode, UserStatus } from "@prisma/client";
import type { Student } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type {
  CreateStudentProfileForAdmissionInput,
  StudentListFilters,
  UpdateStudentInput,
} from "./sis.types.js";

const studentProfileInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  },
} satisfies Prisma.StudentInclude;

const studyModeAdmissionInclude = {
  application: {
    select: {
      id: true,
      status: true,
      studentId: true,
      studyMode: true,
    },
  },
  student: {
    select: { user: { select: { status: true } } },
  },
} satisfies Prisma.AdmissionRecordInclude;

/** Student profile with safe account details for SIS workflows. */
export type StudentProfile = Prisma.StudentGetPayload<{
  include: typeof studentProfileInclude;
}>;

/** Admission record and application state required for a study-mode change. */
export type StudyModeAdmission = Prisma.AdmissionRecordGetPayload<{
  include: typeof studyModeAdmissionInclude;
}>;

/** Result of an audited study-mode update. */
export type StudyModeChangeOutcome =
  | { kind: "not_found" }
  | { kind: "unchanged" }
  | { kind: "inconsistent" }
  | { kind: "changed"; admission: StudyModeAdmission; previousMode: StudyMode };

/** Successful study-mode change outcome after repository guards have passed. */
export type ChangedStudyMode = Extract<StudyModeChangeOutcome, { kind: "changed" }>;

/** Performs student-profile persistence using Prisma. */
@Injectable()
export class StudentsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Lists non-archived profiles using a bounded search and offset page. */
  async list(
    filters: StudentListFilters & { skip: number; take: number; userId?: string },
  ): Promise<{ students: StudentProfile[]; total: number }> {
    const search = filters.search?.trim();
    const where: Prisma.StudentWhereInput = {
      user: {
        is: {
          status: { not: UserStatus.DEACTIVATED },
          ...(filters.userId === undefined ? {} : { id: filters.userId }),
        },
      },
      ...(search
        ? {
            OR: [
              { studentNumber: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { user: { is: { name: { contains: search, mode: "insensitive" } } } },
              { user: { is: { email: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [students, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: studentProfileInclude,
        orderBy: [{ studentNumber: "asc" }, { id: "asc" }],
        skip: filters.skip,
        take: filters.take,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { students, total };
  }

  /** Finds an active student profile. */
  findById(id: string): Promise<StudentProfile | null> {
    return this.prisma.student.findFirst({
      where: {
        id,
        user: { is: { status: { not: UserStatus.DEACTIVATED } } },
      },
      include: studentProfileInclude,
    });
  }

  /** Finds profile ownership and account status, including archived profiles. */
  async findArchiveTarget(id: string): Promise<{ userId: string; status: UserStatus } | null> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { userId: true, user: { select: { status: true } } },
    });
    return student === null ? null : { userId: student.userId, status: student.user.status };
  }

  /** Creates an admitted student's profile and audit entry in the admission transaction. */
  async createProfileForAdmission(
    transaction: Prisma.TransactionClient,
    input: CreateStudentProfileForAdmissionInput,
    actorId: string,
  ): Promise<Student | null> {
    const user = await transaction.user.findFirst({
      where: {
        id: input.userId,
        status: UserStatus.ACTIVE,
        studentProfile: { is: null },
      },
      select: { id: true },
    });
    if (user === null) {
      return null;
    }

    const student = await transaction.student.create({
      data: {
        userId: input.userId,
        studentNumber: input.studentNumber,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth,
        nationality: input.nationality,
        schedule: input.schedule,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "sis.student.created_after_admission",
        resourceType: "student",
        resourceId: student.id,
        metadata: { studentNumber: student.studentNumber },
      },
    });
    return student;
  }

  /** Returns the lifecycle status of an acting user. */
  async findUserStatus(userId: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status ?? null;
  }

  /** Updates editable profile fields unless the account has been archived. */
  async update(
    id: string,
    input: UpdateStudentInput,
    actorId: string,
  ): Promise<StudentProfile | null> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.student.updateMany({
        where: {
          id,
          user: { is: { status: { not: UserStatus.DEACTIVATED } } },
        },
        data: input,
      });
      if (updated.count !== 1) {
        return null;
      }

      const student = await transaction.student.findUniqueOrThrow({
        where: { id },
        include: studentProfileInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "sis.student.updated",
          resourceType: "student",
          resourceId: id,
          metadata: { changedFields: Object.keys(input) },
        },
      });
      return student;
    });
  }

  /** Deactivates a student account, revokes sessions, and writes an audit entry atomically. */
  async archive(id: string, actorId: string, archivedAt: Date): Promise<string | null> {
    return this.prisma.$transaction(async (transaction) => {
      const student = await transaction.student.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (student === null) {
        return null;
      }

      const updated = await transaction.user.updateMany({
        where: { id: student.userId, status: { not: UserStatus.DEACTIVATED } },
        data: {
          status: UserStatus.DEACTIVATED,
          deactivatedAt: archivedAt,
          deactivatedById: actorId,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      await transaction.session.updateMany({
        where: { userId: student.userId, revokedAt: null },
        data: { revokedAt: archivedAt },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "sis.student.archived",
          resourceType: "student",
          resourceId: id,
        },
      });
      return student.userId;
    });
  }

  /** Updates both admission-mode records and audits the old and new values atomically. */
  async changeStudyMode(
    applicationId: string,
    studyMode: StudyMode,
    actorId: string,
    reason: string,
  ): Promise<StudyModeChangeOutcome> {
    try {
      return await this.prisma.$transaction(
        async (transaction): Promise<StudyModeChangeOutcome> => {
          const admission = await transaction.admissionRecord.findUnique({
            where: { applicationId },
            include: studyModeAdmissionInclude,
          });
          if (
            admission === null ||
            admission.application.status !== ApplicationStatus.ADMITTED ||
            admission.application.studentId !== admission.studentId ||
            admission.student.user.status !== UserStatus.ACTIVE
          ) {
            return { kind: "not_found" };
          }
          if (admission.studyMode !== admission.application.studyMode) {
            return { kind: "inconsistent" };
          }
          if (admission.studyMode === studyMode) {
            return { kind: "unchanged" };
          }

          const previousMode = admission.studyMode;
          const applicationUpdate = await transaction.application.updateMany({
            where: {
              id: applicationId,
              status: ApplicationStatus.ADMITTED,
              studentId: admission.studentId,
              studyMode: previousMode,
            },
            data: { studyMode },
          });
          if (applicationUpdate.count !== 1) {
            throw new StaleStudyModeChangeError();
          }

          const updatedAdmission = await transaction.admissionRecord.update({
            where: { applicationId },
            data: { studyMode },
            include: studyModeAdmissionInclude,
          });
          await transaction.auditLog.create({
            data: {
              actorId,
              action: "sis.student.study_mode_changed",
              resourceType: "admission_record",
              resourceId: updatedAdmission.id,
              reason,
              metadata: { applicationId, from: previousMode, to: studyMode },
            },
          });
          return { kind: "changed", admission: updatedAdmission, previousMode };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (error instanceof StaleStudyModeChangeError) {
        return { kind: "inconsistent" };
      }
      throw error;
    }
  }
}

class StaleStudyModeChangeError extends Error {}
