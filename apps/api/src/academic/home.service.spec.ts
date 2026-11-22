// Purpose: Test student home aggregation, attendance eligibility, and Redis caching.
import { DeliveryMode, IntakeStatus, StudyMode } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { StorageService } from "../storage/storage.service.js";
import { AnnouncementsService } from "./announcements.service.js";
import { AttendanceService } from "./attendance.service.js";
import { CalendarService } from "./calendar.service.js";
import { HomeCacheService } from "./home-cache.service.js";
import { HomeRepository } from "./home.repository.js";
import { HomeService } from "./home.service.js";

const USER_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const INTAKE_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const OFFERING_ID = "bc02382e-8eac-4aa3-8701-46c813b5bbbd";
const NOW = new Date("2026-11-22T12:00:00.000Z");
const nextSessionStartsAt = new Date(NOW.getTime() + 5 * 60_000);
const nextSessionEndsAt = new Date(NOW.getTime() + 65 * 60_000);

const studentIdentity = {
  id: STUDENT_ID,
  schedule: "DAY",
  user: { id: USER_ID, name: "Student Example" },
  admissionRecords: [{ studyMode: StudyMode.ONLINE, application: { documents: [] } }],
  programmeEnrollments: [{ programme: { id: OFFERING_ID, code: "BSC", name: "Science" } }],
  intakeRegistrations: [
    {
      intake: {
        id: INTAKE_ID,
        name: "Intake 1",
        status: IntakeStatus.ACTIVE,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2027-01-31T23:59:59.999Z"),
        academicYear: { label: "2026/2027" },
      },
    },
  ],
} as NonNullable<Awaited<ReturnType<HomeRepository["findStudentHomeIdentity"]>>>;

const repositoryMock = {
  findLecturerHomeData: vi.fn<HomeRepository["findLecturerHomeData"]>(),
  findRegistrarCurrentIntake: vi.fn<HomeRepository["findRegistrarCurrentIntake"]>(),
  findRegistrarIntakeMetrics: vi.fn<HomeRepository["findRegistrarIntakeMetrics"]>(),
  findStudentHomeCourseUnits: vi.fn<HomeRepository["findStudentHomeCourseUnits"]>(),
  findStudentHomeIdentity: vi.fn<HomeRepository["findStudentHomeIdentity"]>(),
};

const announcementsMock = {
  getForUser: vi.fn<AnnouncementsService["getForUser"]>(),
};

const calendarMock = {
  getEvents: vi.fn<CalendarService["getEvents"]>(),
};

const attendanceMock = {
  getStudentAttendanceSummary: vi.fn<AttendanceService["getStudentAttendanceSummary"]>(),
};

const storageMock = {
  getReadUrl: vi.fn<StorageService["getReadUrl"]>(),
};

const cacheMock = {
  get: vi.fn<HomeCacheService["get"]>(),
  set: vi.fn<HomeCacheService["set"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};

describe("HomeService", () => {
  let service: HomeService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    repositoryMock.findStudentHomeIdentity.mockResolvedValue(studentIdentity);
    repositoryMock.findStudentHomeCourseUnits.mockResolvedValue([
      {
        offeringId: OFFERING_ID,
        offering: {
          deliveryMode: DeliveryMode.ONLINE,
          courseUnit: { code: "BIO101", name: "Biology" },
          intake: { name: "Intake 1" },
          lecturers: [{ lecturer: { user: { name: "Lecturer Example" } } }],
          _count: { registrations: 12 },
          classSessions: [
            {
              startsAt: nextSessionStartsAt,
              endsAt: nextSessionEndsAt,
              deliveryMode: DeliveryMode.ONLINE,
            },
          ],
        },
      },
    ]);
    announcementsMock.getForUser.mockResolvedValue([]);
    calendarMock.getEvents.mockResolvedValue([]);
    attendanceMock.getStudentAttendanceSummary.mockResolvedValue({
      studentId: STUDENT_ID,
      intakeId: INTAKE_ID,
      minimumPercent: 75,
      offerings: [],
      overall: {
        heldSessions: 0,
        presentSessions: 0,
        percentage: null,
        belowMinimum: false,
      },
    });
    storageMock.getReadUrl.mockResolvedValue("https://storage.example/student-photo");
    cacheMock.get.mockResolvedValue(null);
    cacheMock.set.mockResolvedValue();
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:unit:select"],
    });
    service = new HomeService(
      repositoryMock as unknown as HomeRepository,
      announcementsMock as unknown as AnnouncementsService,
      calendarMock as unknown as CalendarService,
      attendanceMock as unknown as AttendanceService,
      storageMock as unknown as StorageService,
      cacheMock as unknown as HomeCacheService,
      rbacMock as unknown as RbacService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns role-specific lecturer home data for assigned teaching load", async () => {
    // Arrange: the lecturer has one assigned offering and today's scheduled session.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["lecturer"],
      permissions: ["academic:session:manage"],
    });
    repositoryMock.findLecturerHomeData.mockResolvedValue({
      lecturer: {
        id: "987a3c4d-77de-4e67-91b1-67b97c4acdef",
        offerings: [
          {
            offering: {
              id: OFFERING_ID,
              courseUnit: { code: "CS101", name: "Computer Science" },
              intake: { name: "Intake 1" },
              _count: { registrations: 20 },
            },
          },
        ],
      },
      todaysClasses: [
        {
          id: "44beb9c9-a002-483c-a243-730321e4d6c3",
          offeringId: OFFERING_ID,
          startsAt: nextSessionStartsAt,
          endsAt: nextSessionEndsAt,
          deliveryMode: DeliveryMode.ONLINE,
          room: null,
          offering: { courseUnit: { code: "CS101", name: "Computer Science" } },
        },
      ],
    });

    // Act: load the lecturer home.
    const home = await service.getLecturerHome(USER_ID, USER_ID);

    // Assert: assigned course units and today's classes are aggregated without meeting URLs.
    expect(home.courseUnits).toHaveLength(1);
    expect(home.todaysClasses).toHaveLength(1);
    expect(home).not.toHaveProperty("meetingUrl");
  });

  it("returns registrar home selection progress and attention queues", async () => {
    // Arrange: one active intake has both registered and unregistered admitted students.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["registrar"],
      permissions: ["academic:structure:manage"],
    });
    repositoryMock.findRegistrarCurrentIntake.mockResolvedValue({
      id: INTAKE_ID,
      name: "Intake 1",
      status: IntakeStatus.SELECTION_OPEN,
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2027-01-31T23:59:59.999Z"),
      selectionOpensAt: new Date("2026-09-01T00:00:00.000Z"),
      selectionClosesAt: new Date("2026-09-30T23:59:59.999Z"),
      academicYear: { label: "2026/2027" },
    });
    repositoryMock.findRegistrarIntakeMetrics.mockResolvedValue({
      registeredStudents: 10,
      studentsWithSelections: 8,
      offeringsWithoutLecturersCount: 1,
      offeringsWithoutLecturers: [
        { offeringId: OFFERING_ID, code: "CS101", name: "Computer Science" },
      ],
      admittedStudentsWithoutSelectionsCount: 2,
      admittedStudentsWithoutSelections: [],
    });

    // Act: load registrar home.
    const home = await service.getRegistrarHome(USER_ID, USER_ID);

    // Assert: progress and attention counts are returned for operational follow-up.
    expect(home.selectionProgress).toEqual({
      registeredStudents: 10,
      studentsWithSelections: 8,
      percent: 80,
    });
    expect(home.needsAttention.offeringsWithoutLecturersCount).toBe(1);
  });

  it("returns selected units with online attendance eligibility and caches no meeting URL", async () => {
    // Arrange: the next online session starts within the Attend window for an online student.

    // Act: load the student's aggregated home view.
    const home = await service.getStudentHome(USER_ID, USER_ID);

    // Assert: eligibility is true, attendance is included, and the cached shape has no meeting URL.
    expect(home.courseUnits[0]?.nextSession).toEqual({
      startsAt: nextSessionStartsAt,
      deliveryMode: DeliveryMode.ONLINE,
      canAttend: true,
    });
    expect(home.attendanceSummary?.overall.heldSessions).toBe(0);
    expect(home).not.toHaveProperty("meetingUrl");
    expect(cacheMock.set).toHaveBeenCalledWith(USER_ID, "student", home);
    expect(announcementsMock.getForUser).toHaveBeenCalledWith(USER_ID, 5);
    expect(calendarMock.getEvents).toHaveBeenCalledOnce();
  });

  it("uses a valid cached student view without reloading repository data", async () => {
    // Arrange: a cached response has the fields required by the student view schema.
    cacheMock.get.mockResolvedValue({
      userId: USER_ID,
      profile: {
        name: "Student Example",
        photoUrl: null,
        programme: null,
        intake: null,
        schedule: null,
        studyMode: null,
      },
      announcements: [],
      events: [],
      courseUnits: [],
      attendanceSummary: null,
    });

    // Act: request the same home view.
    const home = await service.getStudentHome(USER_ID, USER_ID);

    // Assert: the cached payload is returned directly.
    expect(home.userId).toBe(USER_ID);
    expect(repositoryMock.findStudentHomeIdentity).not.toHaveBeenCalled();
  });
});
