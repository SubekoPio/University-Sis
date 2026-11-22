// Purpose: Test announcement sanitization, lecturer audience scope, and calendar aggregation.
import {
  AnnouncementCategory,
  AnnouncementStatus,
  CalendarEventType,
  CommunicationAudienceType,
  DeliveryMode,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RbacService } from "../common/rbac/rbac.service.js";
import { StorageService } from "../storage/storage.service.js";
import { AnnouncementsService } from "./announcements.service.js";
import { CalendarEventProviderRegistry } from "./calendar-event-provider.registry.js";
import { CalendarService } from "./calendar.service.js";
import type { CommunicationsRepository } from "./communications.repository.js";
import type { AnnouncementRecord, CreateAnnouncementInput } from "./announcements.types.js";
import type { CommunicationAudienceContext } from "./communications.types.js";
import { matchesAudience } from "./communications.types.js";
import { TimetableRepository } from "./timetable.repository.js";

const ACTOR_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const OFFERING_ID = "bc02382e-8eac-4aa3-8701-46c813b5bbbd";
const OTHER_OFFERING_ID = "4f85ee14-f270-444a-9cb8-ff6da5a31585";
const EVENT_ID = "44beb9c9-a002-483c-a243-730321e4d6c3";
const RANGE_START = new Date("2026-11-01T00:00:00.000Z");
const RANGE_END = new Date("2026-11-30T23:59:59.999Z");
const eventStart = new Date("2026-11-10T09:00:00.000Z");
const eventEnd = new Date("2026-11-10T10:00:00.000Z");

const audienceContext: CommunicationAudienceContext = {
  userId: ACTOR_ID,
  roleIds: [],
  student: {
    studentId: "93e81866-3eea-4bdf-b681-b18696f22af7",
    programmeIds: [],
    facultyIds: [],
    intakeIds: [],
    offeringIds: [OFFERING_ID],
  },
  lecturer: null,
};

const announcementRecord: AnnouncementRecord = {
  id: EVENT_ID,
  title: "Course update",
  body: "<p>Safe message</p>",
  imageKey: null,
  category: AnnouncementCategory.GENERAL,
  status: AnnouncementStatus.DRAFT,
  isPinned: false,
  sortOrder: 0,
  publishAt: eventStart,
  expiresAt: null,
  createdById: ACTOR_ID,
  createdAt: eventStart,
  updatedAt: eventStart,
  audiences: [{ audienceType: CommunicationAudienceType.ALL_STUDENTS, targetId: null }],
};

const repositoryMock = {
  createAnnouncement: vi.fn<CommunicationsRepository["createAnnouncement"]>(),
  findAudienceContext: vi.fn<CommunicationsRepository["findAudienceContext"]>(),
  findAnnouncement: vi.fn<CommunicationsRepository["findAnnouncement"]>(),
  findCalendarEvents: vi.fn<CommunicationsRepository["findCalendarEvents"]>(),
  findCalendarSessions: vi.fn<CommunicationsRepository["findCalendarSessions"]>(),
  findIntakeCalendarSources: vi.fn<CommunicationsRepository["findIntakeCalendarSources"]>(),
  findPublishedAnnouncements: vi.fn<CommunicationsRepository["findPublishedAnnouncements"]>(),
  hasAudienceTarget: vi.fn<CommunicationsRepository["hasAudienceTarget"]>(),
  updateAnnouncementStatus: vi.fn<CommunicationsRepository["updateAnnouncementStatus"]>(),
};

const rbacMock = {
  getAuthorizationSnapshot: vi.fn<RbacService["getAuthorizationSnapshot"]>(),
};

const storageMock = {
  deleteObject: vi.fn<StorageService["deleteObject"]>(),
  getReadUrl: vi.fn<StorageService["getReadUrl"]>(),
  storeAnnouncementImage: vi.fn<StorageService["storeAnnouncementImage"]>(),
};

const timetableRepositoryMock = {
  isLecturerAssignedToOffering: vi.fn<TimetableRepository["isLecturerAssignedToOffering"]>(),
};

describe("AnnouncementsService", () => {
  let service: AnnouncementsService;

  beforeEach(() => {
    vi.resetAllMocks();
    repositoryMock.findAudienceContext.mockResolvedValue(audienceContext);
    repositoryMock.findAnnouncement.mockResolvedValue(announcementRecord);
    repositoryMock.createAnnouncement.mockResolvedValue(announcementRecord);
    repositoryMock.findPublishedAnnouncements.mockResolvedValue([]);
    repositoryMock.hasAudienceTarget.mockResolvedValue(true);
    repositoryMock.updateAnnouncementStatus.mockResolvedValue(announcementRecord);
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["announcements:manage"],
    });
    storageMock.deleteObject.mockResolvedValue();
    storageMock.getReadUrl.mockResolvedValue("https://storage.example/signed-image");
    storageMock.storeAnnouncementImage.mockResolvedValue("announcements/image.webp");
    timetableRepositoryMock.isLecturerAssignedToOffering.mockResolvedValue(true);
    service = new AnnouncementsService(
      repositoryMock as unknown as CommunicationsRepository,
      rbacMock as unknown as RbacService,
      storageMock as unknown as StorageService,
      timetableRepositoryMock as unknown as TimetableRepository,
    );
  });

  it("matches all-student and selected-offering announcement audiences", () => {
    // Arrange: the student context belongs to one offering.
    const context = audienceContext;

    // Act / Assert: all-student and matching offering audiences pass, unrelated offering fails.
    expect(
      matchesAudience(
        { audienceType: CommunicationAudienceType.ALL_STUDENTS, targetId: null },
        context,
      ),
    ).toBe(true);
    expect(
      matchesAudience(
        { audienceType: CommunicationAudienceType.COURSE_UNIT_OFFERING, targetId: OFFERING_ID },
        context,
      ),
    ).toBe(true);
    expect(
      matchesAudience(
        {
          audienceType: CommunicationAudienceType.COURSE_UNIT_OFFERING,
          targetId: OTHER_OFFERING_ID,
        },
        context,
      ),
    ).toBe(false);
  });

  it("removes script markup from announcement bodies before persistence", async () => {
    // Arrange: provide rich text containing executable markup and a valid all-student audience.
    const input: CreateAnnouncementInput = {
      title: "Course update",
      body: "<p>Safe <strong>message</strong></p><script>alert(1)</script>",
      category: AnnouncementCategory.GENERAL,
      audiences: [{ audienceType: CommunicationAudienceType.ALL_STUDENTS, targetId: null }],
    };

    // Act: create the announcement through the service boundary.
    await service.create(input, ACTOR_ID);

    // Assert: only sanitized content reaches persistence.
    expect(repositoryMock.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ body: "<p>Safe <strong>message</strong></p>" }),
    );
  });

  it("stores announcement image bytes before persisting their private object key", async () => {
    // Arrange: provide a JPEG image and a valid all-student audience.
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const input: CreateAnnouncementInput = {
      title: "Course update",
      body: "Safe message",
      category: AnnouncementCategory.GENERAL,
      audiences: [{ audienceType: CommunicationAudienceType.ALL_STUDENTS, targetId: null }],
      image: { bytes, contentType: "image/jpeg" },
    };

    // Act: create the announcement.
    await service.create(input, ACTOR_ID);

    // Assert: persistence stores the provider key, not the uploaded bytes or a public URL.
    expect(storageMock.storeAnnouncementImage).toHaveBeenCalledWith(input.image);
    expect(repositoryMock.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ imageKey: "announcements/image.webp" }),
    );
  });

  it("publishes a draft announcement through the repository status transition", async () => {
    // Arrange: the actor can manage the existing draft announcement.
    repositoryMock.updateAnnouncementStatus.mockResolvedValue({
      ...announcementRecord,
      status: AnnouncementStatus.PUBLISHED,
    });

    // Act: publish the draft.
    const result = await service.publish(EVENT_ID, ACTOR_ID);

    // Assert: persist and return the published state.
    expect(repositoryMock.updateAnnouncementStatus).toHaveBeenCalledWith(
      EVENT_ID,
      AnnouncementStatus.PUBLISHED,
    );
    expect(result.status).toBe(AnnouncementStatus.PUBLISHED);
  });

  it("archives an announcement and returns its archived state", async () => {
    // Arrange: the actor can manage the existing announcement.
    repositoryMock.updateAnnouncementStatus.mockResolvedValue({
      ...announcementRecord,
      status: AnnouncementStatus.ARCHIVED,
    });

    // Act: archive the announcement.
    const result = await service.archive(EVENT_ID, ACTOR_ID);

    // Assert: persist and return the archived state.
    expect(repositoryMock.updateAnnouncementStatus).toHaveBeenCalledWith(
      EVENT_ID,
      AnnouncementStatus.ARCHIVED,
    );
    expect(result.status).toBe(AnnouncementStatus.ARCHIVED);
  });

  it("loads the requested number of audience-visible announcements", async () => {
    // Arrange: return one published announcement for the matching student context.
    const published = { ...announcementRecord, status: AnnouncementStatus.PUBLISHED };
    repositoryMock.findPublishedAnnouncements.mockResolvedValue([published]);

    // Act: request the audience feed.
    const result = await service.getForUser(ACTOR_ID, 5);

    // Assert: query with the resolved audience and return only the service view.
    expect(repositoryMock.findPublishedAnnouncements).toHaveBeenCalledWith(
      audienceContext,
      expect.any(Date),
      5,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe(AnnouncementStatus.PUBLISHED);
  });

  it("rejects lecturer announcements targeting another lecturer's offering", async () => {
    // Arrange: the actor has only the lecturer-specific posting permission.
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: ["announcements:post-own"],
    });
    repositoryMock.findAudienceContext.mockResolvedValue({
      ...audienceContext,
      student: null,
      lecturer: {
        lecturerId: "93e81866-3eea-4bdf-b681-b18696f22af7",
        facultyIds: [],
        intakeIds: [],
        offeringIds: [OFFERING_ID],
      },
    });
    timetableRepositoryMock.isLecturerAssignedToOffering.mockResolvedValue(false);

    // Act / Assert: an unassigned offering is rejected before announcement persistence.
    await expect(
      service.create(
        {
          title: "Course update",
          body: "Safe message",
          category: AnnouncementCategory.GENERAL,
          audiences: [
            {
              audienceType: CommunicationAudienceType.COURSE_UNIT_OFFERING,
              targetId: OTHER_OFFERING_ID,
            },
          ],
        },
        ACTOR_ID,
      ),
    ).rejects.toThrow("Lecturers may post only to their own course-unit offerings.");
    expect(repositoryMock.createAnnouncement).not.toHaveBeenCalled();
  });
});

describe("CalendarService", () => {
  let service: CalendarService;
  let providers: CalendarEventProviderRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    providers = new CalendarEventProviderRegistry();
    repositoryMock.findAudienceContext.mockResolvedValue(audienceContext);
    repositoryMock.findCalendarEvents.mockResolvedValue([
      {
        id: EVENT_ID,
        title: "Institution event",
        description: "",
        type: CalendarEventType.EVENT,
        startsAt: eventStart,
        endsAt: eventEnd,
        allDay: false,
        audiences: [],
      },
      {
        id: OTHER_OFFERING_ID,
        title: "Other course",
        description: "",
        type: CalendarEventType.ACADEMIC,
        startsAt: eventStart,
        endsAt: eventEnd,
        allDay: false,
        audiences: [
          {
            audienceType: CommunicationAudienceType.COURSE_UNIT_OFFERING,
            targetId: OTHER_OFFERING_ID,
          },
        ],
      },
    ]);
    repositoryMock.findIntakeCalendarSources.mockResolvedValue([]);
    repositoryMock.findCalendarSessions.mockResolvedValue([
      {
        id: "ad85fb39-d64d-4c28-9c44-ea38bfc1432a",
        startsAt: new Date("2026-11-12T09:00:00.000Z"),
        endsAt: new Date("2026-11-12T10:00:00.000Z"),
        deliveryMode: DeliveryMode.ONLINE,
        room: null,
        offering: {
          id: OFFERING_ID,
          courseUnit: { code: "BIO101", name: "Biology" },
        },
      },
    ]);
    rbacMock.getAuthorizationSnapshot.mockResolvedValue({ roles: [], permissions: [] });
    providers.register({
      key: "test-provider",
      getEvents: async () => [
        {
          id: "provider-event",
          title: "Assignment due",
          description: "Submit work",
          startsAt: new Date("2026-11-15T09:00:00.000Z"),
          endsAt: new Date("2026-11-15T09:00:00.000Z"),
          allDay: true,
        },
      ],
    });
    service = new CalendarService(
      repositoryMock as unknown as CommunicationsRepository,
      providers,
      rbacMock as unknown as RbacService,
    );
  });

  it("merges global events, selected sessions, and provider events without meeting links", async () => {
    // Arrange: the registered provider and repository expose events for the requested month.

    // Act: load the user's combined calendar.
    const events = await service.getEvents(ACTOR_ID, RANGE_START, RANGE_END);

    // Assert: global events and selected sessions appear, unrelated events do not, and no link leaks.
    expect(events.map(({ id }) => id)).toEqual([
      `calendar:${EVENT_ID}`,
      "session:ad85fb39-d64d-4c28-9c44-ea38bfc1432a",
      "provider:test-provider:provider-event",
    ]);
    expect(events.every((event) => !("meetingUrl" in event))).toBe(true);
    expect(repositoryMock.findCalendarSessions).toHaveBeenCalledWith(
      [OFFERING_ID],
      RANGE_START,
      RANGE_END,
    );
  });

  it("rejects calendar ranges longer than 62 days", async () => {
    // Arrange: request a range one millisecond beyond the supported maximum.
    const tooLate = new Date(RANGE_START.getTime() + 62 * 24 * 60 * 60 * 1000 + 1);

    // Act / Assert: reject before querying context or calendar sources.
    await expect(service.getEvents(ACTOR_ID, RANGE_START, tooLate)).rejects.toThrow(
      "Calendar ranges may not exceed 62 days.",
    );
    expect(repositoryMock.findAudienceContext).not.toHaveBeenCalled();
  });
});
