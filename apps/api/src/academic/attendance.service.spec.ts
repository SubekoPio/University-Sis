// Purpose: Test attendance CSV matching, job computation, and reasoned overrides.
import { AttendanceStatus, ClassSessionStatus, DeliveryMode } from "@prisma/client";
import type { AttendanceRule } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AttendanceRepository, type AttendanceSessionRoster } from "./attendance.repository.js";
import { AttendanceService } from "./attendance.service.js";
import { HomeCacheService } from "./home-cache.service.js";
import { TimetableRepository } from "./timetable.repository.js";

const SESSION_ID = "44beb9c9-a002-483c-a243-730321e4d6c3";
const OFFERING_ID = "bc02382e-8eac-4aa3-8701-46c813b5bbbd";
const STUDENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const SECOND_STUDENT_ID = "d91dd239-28fd-47ac-b9ad-3d37aad583e1";
const STUDENT_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const LECTURER_USER_ID = "18735006-84f4-4fa2-b49d-9f8bb434a87f";
const INTAKE_ID = "0be40467-62d3-4f4d-bb4d-6a23e3b986fb";
const SESSION_START = new Date("2026-11-21T09:00:00.000Z");
const SESSION_END = new Date("2026-11-21T11:00:00.000Z");
const NOW = new Date("2026-11-22T12:00:00.000Z");

const sessionRoster: AttendanceSessionRoster = {
  id: SESSION_ID,
  offeringId: OFFERING_ID,
  startsAt: SESSION_START,
  endsAt: SESSION_END,
  deliveryMode: DeliveryMode.ONLINE,
  status: ClassSessionStatus.HELD,
  offering: {
    id: OFFERING_ID,
    intakeId: INTAKE_ID,
    registrations: [
      {
        studentId: STUDENT_ID,
        student: { user: { email: "learner@example.test" } },
      },
      {
        studentId: SECOND_STUDENT_ID,
        student: { user: { email: "shared@example.test" } },
      },
    ],
  },
};

const attendanceRule: AttendanceRule = {
  id: 1,
  minContinuousPercent: 75,
  reconnectGraceSeconds: 180,
  minAttendancePercentWarning: 75,
  createdAt: NOW,
  updatedAt: NOW,
};

const repositoryMock = {
  computeSessionAttendance: vi.fn<AttendanceRepository["computeSessionAttendance"]>(),
  findActiveStudentUserId: vi.fn<AttendanceRepository["findActiveStudentUserId"]>(),
  findActiveStudentUserIds: vi.fn<AttendanceRepository["findActiveStudentUserIds"]>(),
  findAttendanceRule: vi.fn<AttendanceRepository["findAttendanceRule"]>(),
  findSessionRoster: vi.fn<AttendanceRepository["findSessionRoster"]>(),
  findStudentAttendanceRows: vi.fn<AttendanceRepository["findStudentAttendanceRows"]>(),
  hasActiveIntake: vi.fn<AttendanceRepository["hasActiveIntake"]>(),
  insertPresenceIntervals: vi.fn<AttendanceRepository["insertPresenceIntervals"]>(),
  markPhysicalAttendance: vi.fn<AttendanceRepository["markPhysicalAttendance"]>(),
  overrideAttendance: vi.fn<AttendanceRepository["overrideAttendance"]>(),
};

const timetableRepositoryMock = {
  isLecturerAssignedToOffering: vi.fn<TimetableRepository["isLecturerAssignedToOffering"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};
const homeCacheMock = {
  invalidateUser: vi.fn<HomeCacheService["invalidateUser"]>(),
};

describe("AttendanceService", () => {
  let service: AttendanceService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositoryMock.findSessionRoster.mockResolvedValue(sessionRoster);
    repositoryMock.insertPresenceIntervals.mockResolvedValue({
      kind: "inserted",
      count: 1,
    });
    repositoryMock.findAttendanceRule.mockResolvedValue(attendanceRule);
    repositoryMock.findActiveStudentUserId.mockResolvedValue(STUDENT_USER_ID);
    repositoryMock.findActiveStudentUserIds.mockResolvedValue([STUDENT_USER_ID]);
    repositoryMock.hasActiveIntake.mockResolvedValue(true);
    repositoryMock.overrideAttendance.mockResolvedValue({
      kind: "overridden",
      previousStatus: AttendanceStatus.ABSENT,
    });
    timetableRepositoryMock.isLecturerAssignedToOffering.mockResolvedValue(true);
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: [],
    });
    homeCacheMock.invalidateUser.mockResolvedValue();
    service = new AttendanceService(
      repositoryMock as unknown as AttendanceRepository,
      timetableRepositoryMock as unknown as TimetableRepository,
      rbacMock as unknown as RbacService,
      homeCacheMock as unknown as HomeCacheService,
    );
  });

  it("shows the shared offering class list and matches both enrolled programme students", async () => {
    // Arrange: a lecturer imports a report for an offering shared by multiple programmes.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:attendance:record_assigned"],
    });
    const csv = [
      "email,join,leave",
      "learner@example.test,2026-11-21T09:10:00Z,2026-11-21T09:45:00Z",
      "SHARED@example.test,2026-11-21T09:20:00Z,2026-11-21T09:50:00Z",
    ].join("\r\n");
    repositoryMock.insertPresenceIntervals.mockResolvedValue({
      kind: "inserted",
      count: 2,
    });

    // Act: import the shared class report.
    const result = await service.importPresenceReport(SESSION_ID, csv, LECTURER_USER_ID);

    // Assert: every selected student from the shared roster is accepted.
    expect(result.importedIntervals).toBe(2);
    expect(repositoryMock.insertPresenceIntervals).toHaveBeenCalledWith(
      SESSION_ID,
      [
        {
          studentId: STUDENT_ID,
          joinedAt: new Date("2026-11-21T09:10:00Z"),
          leftAt: new Date("2026-11-21T09:45:00Z"),
        },
        {
          studentId: SECOND_STUDENT_ID,
          joinedAt: new Date("2026-11-21T09:20:00Z"),
          leftAt: new Date("2026-11-21T09:50:00Z"),
        },
      ],
      "REPORT_IMPORT",
    );
  });

  it("denies an unassigned lecturer access to another offering's class list", async () => {
    // Arrange: the lecturer has attendance permission but is not assigned to this offering.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:attendance:record_assigned"],
    });
    timetableRepositoryMock.isLecturerAssignedToOffering.mockResolvedValue(false);

    // Act / Assert: fail ownership before parsing or persisting a class report.
    await expect(
      service.importPresenceReport(
        SESSION_ID,
        "email,join,leave\nlearner@example.test,,",
        LECTURER_USER_ID,
      ),
    ).rejects.toThrow("Lecturers may manage attendance only for assigned offerings.");
    expect(repositoryMock.insertPresenceIntervals).not.toHaveBeenCalled();
  });

  it("matches report emails case-insensitively and returns unmatched rows", async () => {
    // Arrange: the lecturer can record an assigned online session's report.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["academic:attendance:record_assigned"],
    });
    const csv = [
      "email,join,leave",
      "LEARNER@example.test,2026-11-21T09:10:00Z,2026-11-21T09:45:00Z",
      "missing@example.test,2026-11-21T09:15:00Z,2026-11-21T09:30:00Z",
    ].join("\r\n");

    // Act: import the CSV report.
    const result = await service.importPresenceReport(SESSION_ID, csv, LECTURER_USER_ID);

    // Assert: only matched students are persisted and unmatched row details are returned.
    expect(result).toEqual({
      importedIntervals: 1,
      unmatchedRows: [
        {
          rowNumber: 3,
          email: "missing@example.test",
          joinedAt: new Date("2026-11-21T09:15:00Z"),
          leftAt: new Date("2026-11-21T09:30:00Z"),
        },
      ],
    });
    expect(repositoryMock.insertPresenceIntervals).toHaveBeenCalledWith(
      SESSION_ID,
      [
        {
          studentId: STUDENT_ID,
          joinedAt: new Date("2026-11-21T09:10:00Z"),
          leftAt: new Date("2026-11-21T09:45:00Z"),
        },
      ],
      "REPORT_IMPORT",
    );
  });

  it("computes each student's outcome from the longest continuous stay", async () => {
    // Arrange: two 55-minute visits have more total time than the threshold but exceed grace.
    const snapshot = {
      session: {
        id: SESSION_ID,
        startsAt: SESSION_START,
        endsAt: SESSION_END,
        deliveryMode: DeliveryMode.ONLINE,
        status: ClassSessionStatus.HELD,
      },
      rule: attendanceRule,
      students: [
        {
          studentId: STUDENT_ID,
          intervals: [
            {
              joinedAt: SESSION_START,
              leftAt: new Date(SESSION_START.getTime() + 55 * 60_000),
            },
            {
              joinedAt: new Date(SESSION_START.getTime() + 65 * 60_000),
              leftAt: SESSION_END,
            },
          ],
        },
      ],
    };
    repositoryMock.computeSessionAttendance.mockImplementation(
      async (_id, _computedAt, calculate) => {
        const outcomes = calculate(snapshot);
        expect(outcomes).toEqual([
          {
            studentId: STUDENT_ID,
            method: "ONLINE_PRESENCE",
            status: AttendanceStatus.ABSENT,
            longestContinuousSeconds: 55 * 60,
            totalSeconds: 110 * 60,
          },
        ]);
        return {
          kind: "computed",
          computedCount: outcomes.length,
          updatedCount: outcomes.length,
          presentCount: outcomes.filter(({ status }) => status === AttendanceStatus.PRESENT).length,
        };
      },
    );

    // Act: run the scheduled attendance computation.
    const result = await service.computeSessionAttendance(SESSION_ID);

    // Assert: the job response reflects the calculated absent result.
    expect(result).toEqual({
      computedCount: 1,
      updatedCount: 1,
      presentCount: 0,
    });
    expect(homeCacheMock.invalidateUser).toHaveBeenCalledWith(STUDENT_USER_ID);
  });

  it("requires a reason and assigned-offering override permission", async () => {
    // Arrange: the lecturer may override records for the assigned offering.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["attendance:override"],
    });

    // Act: override the outcome with a padded reason.
    const result = await service.overrideAttendance(
      SESSION_ID,
      STUDENT_ID,
      AttendanceStatus.PRESENT,
      "  Verified against the lecturer's register.  ",
      LECTURER_USER_ID,
    );

    // Assert: the reason is normalized and the override result is returned.
    expect(result).toEqual({
      previousStatus: AttendanceStatus.ABSENT,
      status: AttendanceStatus.PRESENT,
    });
    expect(repositoryMock.overrideAttendance).toHaveBeenCalledWith(
      SESSION_ID,
      STUDENT_ID,
      AttendanceStatus.PRESENT,
      LECTURER_USER_ID,
      "Verified against the lecturer's register.",
      expect.any(Date),
    );
  });

  it("rejects overrides without a written reason", async () => {
    // Arrange: the lecturer has override permission on the assigned offering.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["attendance:override"],
    });

    // Act / Assert: empty reasons do not persist an override.
    await expect(
      service.overrideAttendance(
        SESSION_ID,
        STUDENT_ID,
        AttendanceStatus.PRESENT,
        " ",
        LECTURER_USER_ID,
      ),
    ).rejects.toThrow("Attendance override reason is required.");
    expect(repositoryMock.overrideAttendance).not.toHaveBeenCalled();
  });
});
