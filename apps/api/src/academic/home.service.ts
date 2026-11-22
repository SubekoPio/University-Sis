// Purpose: Build one-call home responses and cache them for authenticated users.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DeliveryMode, StudyMode } from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { StorageService } from "../storage/storage.service.js";
import { AttendanceService } from "./attendance.service.js";
import { AnnouncementsService } from "./announcements.service.js";
import { CalendarService } from "./calendar.service.js";
import { HomeCacheService } from "./home-cache.service.js";
import { HomeRepository } from "./home.repository.js";
import {
  homeCacheSchemas,
  type LecturerHomeView,
  type RegistrarHomeView,
  type StudentHomeView,
} from "./home.types.js";

const STUDENT_HOME_PERMISSION = "academic:unit:select";
const LECTURER_HOME_PERMISSION = "academic:session:manage";
const REGISTRAR_HOME_PERMISSION = "academic:structure:manage";
const ATTENDANCE_OPEN_MINUTES = 10;

/** Provides one-call aggregated home views with per-user Redis caching. */
@Injectable()
export class HomeService {
  /** Receives home persistence, component services, storage, cache, and RBAC. */
  constructor(
    private readonly repository: HomeRepository,
    private readonly announcements: AnnouncementsService,
    private readonly calendar: CalendarService,
    private readonly attendance: AttendanceService,
    private readonly storage: StorageService,
    private readonly cache: HomeCacheService,
    private readonly rbac: RbacService,
  ) {}

  /** Returns a student's profile, selected course units, calendar, and attendance summary. */
  async getStudentHome(userId: string, actorId: string): Promise<StudentHomeView> {
    const user = await this.assertOwnPermission(userId, actorId, STUDENT_HOME_PERMISSION);
    const cached = await this.cache.get(user, "student", (value) => {
      const parsed = homeCacheSchemas.student.safeParse(value);
      return parsed.success ? parsed.data : null;
    });
    if (cached !== null) {
      return cached;
    }

    const now = new Date();
    const identity = await this.repository.findStudentHomeIdentity(user, now);
    if (identity === null) {
      throw new NotFoundException("Active student profile not found.");
    }
    const intake = identity.intakeRegistrations[0]?.intake ?? null;
    const [courseUnits, announcements, events, attendanceSummary, photoUrl] = await Promise.all([
      intake === null
        ? Promise.resolve([])
        : this.repository.findStudentHomeCourseUnits(identity.id, intake.id, now),
      this.announcements.getForUser(user, 5),
      this.calendar.getEvents(user, ...this.currentMonthRange(now)),
      intake === null
        ? Promise.resolve(null)
        : this.attendance.getStudentAttendanceSummary(identity.id, intake.id, user),
      this.readPhotoUrl(identity.admissionRecords[0]?.application.documents[0]?.storageKey),
    ]);

    const home: StudentHomeView = {
      userId: user,
      profile: {
        name: identity.user.name,
        photoUrl,
        programme: identity.programmeEnrollments[0]?.programme ?? null,
        intake:
          intake === null
            ? null
            : {
                id: intake.id,
                name: intake.name,
                academicYearLabel: intake.academicYear.label,
                status: intake.status,
              },
        schedule: identity.schedule,
        studyMode: identity.admissionRecords[0]?.studyMode ?? null,
      },
      announcements,
      events,
      courseUnits: courseUnits.map((registration) => {
        const session = registration.offering.classSessions[0];
        return {
          offeringId: registration.offeringId,
          code: registration.offering.courseUnit.code,
          name: registration.offering.courseUnit.name,
          intakeName: registration.offering.intake.name,
          studentCount: registration.offering._count.registrations,
          lecturers: registration.offering.lecturers
            .map(({ lecturer }) => lecturer.user.name)
            .filter((name): name is string => name !== null),
          nextSession:
            session === undefined
              ? null
              : {
                  startsAt: session.startsAt,
                  deliveryMode: session.deliveryMode,
                  canAttend: this.canAttend(
                    session,
                    registration.offering.deliveryMode,
                    identity.admissionRecords[0]?.studyMode,
                    now,
                  ),
                },
        };
      }),
      attendanceSummary,
    };
    await this.cache.set(user, "student", home);
    return home;
  }

  /** Returns current teaching units, today's classes, announcements, and calendar. */
  async getLecturerHome(userId: string, actorId: string): Promise<LecturerHomeView> {
    const user = await this.assertOwnPermission(userId, actorId, LECTURER_HOME_PERMISSION);
    const cached = await this.cache.get(user, "lecturer", (value) => {
      const parsed = homeCacheSchemas.lecturer.safeParse(value);
      return parsed.success ? parsed.data : null;
    });
    if (cached !== null) {
      return cached;
    }

    const now = new Date();
    const [dayStart, nextDay] = this.utcDayRange(now);
    const [lecturerData, announcements, events] = await Promise.all([
      this.repository.findLecturerHomeData(user, dayStart, nextDay),
      this.announcements.getForUser(user, 5),
      this.calendar.getEvents(user, ...this.currentMonthRange(now)),
    ]);
    if (lecturerData === null) {
      throw new NotFoundException("Active lecturer profile not found.");
    }

    const home: LecturerHomeView = {
      userId: user,
      announcements,
      events,
      courseUnits: lecturerData.lecturer.offerings.map(({ offering }) => ({
        offeringId: offering.id,
        code: offering.courseUnit.code,
        name: offering.courseUnit.name,
        intakeName: offering.intake.name,
        studentCount: offering._count.registrations,
      })),
      todaysClasses: lecturerData.todaysClasses.map((session) => ({
        sessionId: session.id,
        offeringId: session.offeringId,
        courseUnitCode: session.offering.courseUnit.code,
        courseUnitName: session.offering.courseUnit.name,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        deliveryMode: session.deliveryMode,
        room: session.room,
      })),
    };
    await this.cache.set(user, "lecturer", home);
    return home;
  }

  /** Returns the current intake, selection progress, attention queues, and calendar. */
  async getRegistrarHome(userId: string, actorId: string): Promise<RegistrarHomeView> {
    const user = await this.assertOwnPermission(userId, actorId, REGISTRAR_HOME_PERMISSION);
    const cached = await this.cache.get(user, "registrar", (value) => {
      const parsed = homeCacheSchemas.registrar.safeParse(value);
      return parsed.success ? parsed.data : null;
    });
    if (cached !== null) {
      return cached;
    }

    const now = new Date();
    const currentIntake = await this.repository.findRegistrarCurrentIntake(now);
    const [announcements, events, metrics] = await Promise.all([
      this.announcements.getForUser(user, 5),
      this.calendar.getEvents(user, ...this.currentMonthRange(now)),
      currentIntake === null
        ? Promise.resolve({
            registeredStudents: 0,
            studentsWithSelections: 0,
            offeringsWithoutLecturersCount: 0,
            offeringsWithoutLecturers: [],
            admittedStudentsWithoutSelectionsCount: 0,
            admittedStudentsWithoutSelections: [],
          })
        : this.repository.findRegistrarIntakeMetrics(currentIntake.id),
    ]);
    const home: RegistrarHomeView = {
      userId: user,
      announcements,
      events,
      currentIntake:
        currentIntake === null
          ? null
          : {
              id: currentIntake.id,
              name: currentIntake.name,
              academicYearLabel: currentIntake.academicYear.label,
              status: currentIntake.status,
              startDate: currentIntake.startDate,
              endDate: currentIntake.endDate,
              selectionOpensAt: currentIntake.selectionOpensAt,
              selectionClosesAt: currentIntake.selectionClosesAt,
            },
      selectionProgress: {
        registeredStudents: metrics.registeredStudents,
        studentsWithSelections: metrics.studentsWithSelections,
        percent:
          metrics.registeredStudents === 0
            ? null
            : Math.round((metrics.studentsWithSelections / metrics.registeredStudents) * 10_000) /
              100,
      },
      needsAttention: {
        offeringsWithoutLecturersCount: metrics.offeringsWithoutLecturersCount,
        offeringsWithoutLecturers: metrics.offeringsWithoutLecturers,
        admittedStudentsWithoutSelectionsCount: metrics.admittedStudentsWithoutSelectionsCount,
        admittedStudentsWithoutSelections: metrics.admittedStudentsWithoutSelections,
      },
    };
    await this.cache.set(user, "registrar", home);
    return home;
  }

  private async assertOwnPermission(
    userId: string,
    actorId: string,
    requiredPermission: string,
  ): Promise<string> {
    const target = this.validateUuid(userId, "User ID");
    const actor = this.validateUuid(actorId, "Actor ID");
    if (target !== actor) {
      throw new ForbiddenException("Users may view only their own home page.");
    }
    const authorization = await this.rbac.getAuthorizationSnapshot(actor);
    if (!authorization.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`The ${requiredPermission} permission is required.`);
    }
    return target;
  }

  private async readPhotoUrl(storageKey: string | undefined): Promise<string | null> {
    return storageKey === undefined ? null : this.storage.getReadUrl(storageKey);
  }

  private currentMonthRange(now: Date): [Date, Date] {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);
    return [start, end];
  }

  private utcDayRange(now: Date): [Date, Date] {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
  }

  private canAttend(
    session: { startsAt: Date; endsAt: Date; deliveryMode: DeliveryMode },
    offeringDeliveryMode: DeliveryMode,
    studyMode: StudyMode | undefined,
    now: Date,
  ): boolean {
    const hasOnlineDelivery =
      (session.deliveryMode === DeliveryMode.ONLINE ||
        session.deliveryMode === DeliveryMode.HYBRID) &&
      (offeringDeliveryMode === DeliveryMode.ONLINE ||
        offeringDeliveryMode === DeliveryMode.HYBRID);
    return (
      studyMode === StudyMode.ONLINE &&
      hasOnlineDelivery &&
      now.getTime() >= session.startsAt.getTime() - ATTENDANCE_OPEN_MINUTES * 60_000 &&
      now.getTime() <= session.endsAt.getTime()
    );
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }
}
