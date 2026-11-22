// Purpose: Test Attend ownership, study-mode, time-window, and private join-link behavior.
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClassSessionStatus, DeliveryMode, StudyMode } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AttendService } from "./attend.service.js";
import { TimetableRepository } from "./timetable.repository.js";
import type { MeetingProvider } from "./timetable.types.js";
import type { EnvironmentConfig } from "../config/environment.config.js";

const STUDENT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const STUDENT_USER_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";
const SESSION_ID = "44beb9c9-a002-483c-a243-730321e4d6c3";
const NOW = new Date("2026-11-22T12:00:00.000Z");

describe("AttendService", () => {
  const repository = {
    findStudentAttendIdentity: vi.fn(),
    findAttendSession: vi.fn(),
    createSessionJoin: vi.fn(),
  };
  const rbac = {
    getAuthorizationSnapshot: vi.fn(),
  };
  const provider = {
    getJoinUrl: vi.fn(),
  };
  const config = {
    get: vi.fn().mockReturnValue(["meet.example.test"]),
  };
  let service: AttendService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.resetAllMocks();
    rbac.getAuthorizationSnapshot.mockResolvedValue({
      roles: ["student"],
      permissions: ["academic:session:attend"],
    });
    repository.findStudentAttendIdentity.mockResolvedValue({
      id: STUDENT_ID,
      userId: STUDENT_USER_ID,
      admissionRecords: [{ studyMode: StudyMode.ONLINE }],
    });
    repository.findAttendSession.mockResolvedValue({
      id: SESSION_ID,
      startsAt: new Date(NOW.getTime() + 5 * 60_000),
      endsAt: new Date(NOW.getTime() + 65 * 60_000),
      status: ClassSessionStatus.SCHEDULED,
      deliveryMode: DeliveryMode.ONLINE,
      meetingUrl: "https://meet.example.test/session/1",
      offering: {
        deliveryMode: DeliveryMode.ONLINE,
        registrations: [{ studentId: STUDENT_ID }],
      },
    });
    repository.createSessionJoin.mockResolvedValue({});
    provider.getJoinUrl.mockResolvedValue("https://meet.example.test/join/private");
    config.get.mockReturnValue(["meet.example.test"]);
    service = new AttendService(
      repository as unknown as TimetableRepository,
      rbac as unknown as RbacService,
      provider as unknown as MeetingProvider,
      config as unknown as ConfigService<EnvironmentConfig, true>,
    );
  });

  it("refuses a physical-study student", async () => {
    // Arrange: the account is enrolled under a physical study mode.
    repository.findStudentAttendIdentity.mockResolvedValue({
      id: STUDENT_ID,
      userId: STUDENT_USER_ID,
      admissionRecords: [{ studyMode: StudyMode.PHYSICAL }],
    });

    // Act / Assert: physical students must attend in person.
    await expect(service.attend(STUDENT_ID, SESSION_ID, STUDENT_USER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(provider.getJoinUrl).not.toHaveBeenCalled();
  });

  it("refuses Attend outside the session window", async () => {
    // Arrange: move more than ten minutes before the session start.
    repository.findAttendSession.mockResolvedValue({
      id: SESSION_ID,
      startsAt: new Date(NOW.getTime() + 30 * 60_000),
      endsAt: new Date(NOW.getTime() + 90 * 60_000),
      status: ClassSessionStatus.SCHEDULED,
      deliveryMode: DeliveryMode.ONLINE,
      meetingUrl: "https://meet.example.test/session/1",
      offering: {
        deliveryMode: DeliveryMode.ONLINE,
        registrations: [{ studentId: STUDENT_ID }],
      },
    });

    // Act / Assert: the click is rejected and not logged.
    await expect(service.attend(STUDENT_ID, SESSION_ID, STUDENT_USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.createSessionJoin).not.toHaveBeenCalled();
  });

  it("returns a join link only from the successful Attend action", async () => {
    // Arrange: the student is online, enrolled, and inside the ten-minute window.

    // Act: perform the Attend action.
    const result = await service.attend(STUDENT_ID, SESSION_ID, STUDENT_USER_ID);

    // Assert: the private URL is returned only by this operation and its click is logged.
    expect(result).toEqual({ meetingUrl: "https://meet.example.test/join/private" });
    expect(repository.createSessionJoin).toHaveBeenCalledWith(STUDENT_ID, SESSION_ID, NOW);
  });
});
