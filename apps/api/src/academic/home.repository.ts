// Purpose: Load batched academic data used to assemble role-specific home views.
import { Injectable } from "@nestjs/common";
import {
  ApplicationDocumentStatus,
  ApplicationDocumentType,
  ClassSessionStatus,
  IntakeRegistrationStatus,
  IntakeStatus,
  ProgrammeEnrollmentStatus,
  UnitRegistrationStatus,
  UserStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const studentHomeSelect = {
  id: true,
  schedule: true,
  user: { select: { id: true, name: true } },
  admissionRecords: {
    orderBy: [{ admittedAt: "desc" }, { id: "asc" }],
    take: 1,
    select: {
      studyMode: true,
      application: {
        select: {
          documents: {
            where: {
              type: ApplicationDocumentType.PHOTO,
              status: ApplicationDocumentStatus.APPROVED,
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
  },
  programmeEnrollments: {
    where: { status: ProgrammeEnrollmentStatus.ACTIVE },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 1,
    select: {
      programme: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.StudentSelect;

/** Prisma persistence for aggregated home views. */
@Injectable()
export class HomeRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Loads an active student's profile, latest admission, and current intake. */
  findStudentHomeIdentity(userId: string, now: Date) {
    return this.prisma.student.findFirst({
      where: { userId, user: { is: { status: UserStatus.ACTIVE } } },
      select: {
        ...studentHomeSelect,
        intakeRegistrations: {
          where: {
            status: IntakeRegistrationStatus.REGISTERED,
            intake: {
              is: {
                deletedAt: null,
                endDate: { gte: now },
                status: { in: [IntakeStatus.SELECTION_OPEN, IntakeStatus.ACTIVE] },
                academicYear: { is: { deletedAt: null } },
              },
            },
          },
          orderBy: [{ intake: { startDate: "desc" } }, { intake: { sequence: "desc" } }],
          take: 1,
          select: {
            intake: {
              select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
                academicYear: { select: { label: true } },
              },
            },
          },
        },
      },
    });
  }

  /** Loads selected current-intake course units and one next session per offering. */
  findStudentHomeCourseUnits(studentId: string, intakeId: string, now: Date) {
    return this.prisma.unitRegistration.findMany({
      where: {
        studentId,
        intakeId,
        status: UnitRegistrationStatus.SELECTED,
        offering: {
          is: {
            status: { not: "CANCELLED" },
            courseUnit: { is: { status: "ACTIVE" } },
          },
        },
      },
      orderBy: [{ offering: { courseUnit: { code: "asc" } } }, { offeringId: "asc" }],
      select: {
        offeringId: true,
        offering: {
          select: {
            deliveryMode: true,
            courseUnit: { select: { code: true, name: true } },
            intake: { select: { name: true } },
            lecturers: {
              orderBy: [{ lecturer: { user: { name: "asc" } } }, { lecturerId: "asc" }],
              select: { lecturer: { select: { user: { select: { name: true } } } } },
            },
            _count: {
              select: { registrations: { where: { status: UnitRegistrationStatus.SELECTED } } },
            },
            classSessions: {
              where: {
                status: ClassSessionStatus.SCHEDULED,
                endsAt: { gte: now },
              },
              orderBy: [{ startsAt: "asc" }, { id: "asc" }],
              take: 1,
              select: { startsAt: true, endsAt: true, deliveryMode: true },
            },
          },
        },
      },
    });
  }

  /** Loads a lecturer's current-intake offerings and today's scheduled classes. */
  async findLecturerHomeData(userId: string, dayStart: Date, nextDay: Date) {
    const lecturer = await this.prisma.lecturer.findFirst({
      where: { userId, user: { is: { status: UserStatus.ACTIVE } } },
      select: {
        id: true,
        offerings: {
          where: {
            offering: {
              is: {
                status: { not: "CANCELLED" },
                intake: {
                  is: {
                    deletedAt: null,
                    status: { in: [IntakeStatus.SELECTION_OPEN, IntakeStatus.ACTIVE] },
                    academicYear: { is: { deletedAt: null } },
                  },
                },
              },
            },
          },
          orderBy: [{ offering: { courseUnit: { code: "asc" } } }, { offeringId: "asc" }],
          select: {
            offering: {
              select: {
                id: true,
                courseUnit: { select: { code: true, name: true } },
                intake: { select: { name: true } },
                _count: {
                  select: {
                    registrations: { where: { status: UnitRegistrationStatus.SELECTED } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (lecturer === null) {
      return null;
    }

    const todaysClasses = await this.prisma.classSession.findMany({
      where: {
        status: { in: [ClassSessionStatus.SCHEDULED, ClassSessionStatus.HELD] },
        startsAt: { lt: nextDay },
        endsAt: { gte: dayStart },
        offering: { is: { lecturers: { some: { lecturerId: lecturer.id } } } },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        offeringId: true,
        startsAt: true,
        endsAt: true,
        deliveryMode: true,
        room: true,
        offering: { select: { courseUnit: { select: { code: true, name: true } } } },
      },
    });
    return { lecturer, todaysClasses };
  }

  /** Selects the current or next non-closed intake for registrar dashboards. */
  async findRegistrarCurrentIntake(now: Date) {
    const current = await this.prisma.intake.findFirst({
      where: {
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
        status: { in: [IntakeStatus.SELECTION_OPEN, IntakeStatus.ACTIVE] },
        endDate: { gte: now },
      },
      orderBy: [{ startDate: "desc" }, { sequence: "desc" }, { id: "asc" }],
      select: this.registrarIntakeSelect,
    });
    if (current !== null) {
      return current;
    }
    return this.prisma.intake.findFirst({
      where: {
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
        status: IntakeStatus.UPCOMING,
      },
      orderBy: [{ startDate: "asc" }, { sequence: "asc" }, { id: "asc" }],
      select: this.registrarIntakeSelect,
    });
  }

  /** Computes selection progress and bounded attention queues for one intake. */
  async findRegistrarIntakeMetrics(intakeId: string) {
    const admittedWithoutSelectionWhere: Prisma.IntakeRegistrationWhereInput = {
      intakeId,
      status: IntakeRegistrationStatus.REGISTERED,
      student: {
        is: {
          admissionRecords: { some: {} },
          unitRegistrations: {
            none: { intakeId, status: UnitRegistrationStatus.SELECTED },
          },
        },
      },
    };
    const offeringWithoutLecturerWhere: Prisma.CourseUnitOfferingWhereInput = {
      intakeId,
      status: { not: "CANCELLED" },
      lecturers: { none: {} },
    };
    const [
      registeredStudents,
      selectedStudentRows,
      offeringsWithoutLecturers,
      offeringsWithoutLecturersCount,
      noSelectionStudents,
      admittedStudentsWithoutSelectionsCount,
    ] = await Promise.all([
      this.prisma.intakeRegistration.count({
        where: { intakeId, status: IntakeRegistrationStatus.REGISTERED },
      }),
      this.prisma.unitRegistration.findMany({
        where: {
          intakeId,
          status: UnitRegistrationStatus.SELECTED,
          student: {
            is: {
              intakeRegistrations: {
                some: { intakeId, status: IntakeRegistrationStatus.REGISTERED },
              },
            },
          },
        },
        distinct: ["studentId"],
        select: { studentId: true },
      }),
      this.prisma.courseUnitOffering.findMany({
        where: offeringWithoutLecturerWhere,
        orderBy: [{ courseUnit: { code: "asc" } }, { id: "asc" }],
        take: 20,
        select: { id: true, courseUnit: { select: { code: true, name: true } } },
      }),
      this.prisma.courseUnitOffering.count({ where: offeringWithoutLecturerWhere }),
      this.prisma.intakeRegistration.findMany({
        where: admittedWithoutSelectionWhere,
        orderBy: [{ student: { studentNumber: "asc" } }, { id: "asc" }],
        take: 20,
        select: {
          student: {
            select: {
              id: true,
              studentNumber: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.intakeRegistration.count({ where: admittedWithoutSelectionWhere }),
    ]);
    return {
      registeredStudents,
      studentsWithSelections: selectedStudentRows.length,
      offeringsWithoutLecturersCount,
      offeringsWithoutLecturers: offeringsWithoutLecturers.map(({ id, courseUnit }) => ({
        offeringId: id,
        code: courseUnit.code,
        name: courseUnit.name,
      })),
      admittedStudentsWithoutSelectionsCount,
      admittedStudentsWithoutSelections: noSelectionStudents.map(({ student }) => ({
        studentId: student.id,
        name: student.user.name,
        studentNumber: student.studentNumber,
      })),
    };
  }

  private readonly registrarIntakeSelect = {
    id: true,
    name: true,
    status: true,
    startDate: true,
    endDate: true,
    selectionOpensAt: true,
    selectionClosesAt: true,
    academicYear: { select: { label: true } },
  } satisfies Prisma.IntakeSelect;
}
