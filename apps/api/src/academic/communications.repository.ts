// Purpose: Persist announcements and load audience-scoped calendar source records.
import { Injectable } from "@nestjs/common";
import {
  AnnouncementStatus,
  CommunicationAudienceType,
  IntakeRegistrationStatus,
  ProgrammeEnrollmentStatus,
  UnitRegistrationStatus,
  UserStatus,
  Prisma,
} from "@prisma/client";
import type { AnnouncementRecord, CreateAnnouncementInput } from "./announcements.types.js";
import type {
  CommunicationAudienceContext,
  CommunicationAudienceInput,
} from "./communications.types.js";
import { getAudienceWhere } from "./communications.types.js";
import { PrismaService } from "../database/prisma.service.js";

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  imageKey: true,
  category: true,
  status: true,
  isPinned: true,
  sortOrder: true,
  publishAt: true,
  expiresAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  audiences: { select: { audienceType: true, targetId: true } },
} satisfies Prisma.AnnouncementSelect;

const audienceContextSelect = {
  id: true,
  roles: { select: { roleId: true } },
  studentProfile: {
    select: {
      id: true,
      programmeEnrollments: {
        where: { status: ProgrammeEnrollmentStatus.ACTIVE },
        select: {
          programmeId: true,
          programme: { select: { department: { select: { facultyId: true } } } },
        },
      },
      intakeRegistrations: {
        where: { status: IntakeRegistrationStatus.REGISTERED },
        select: { intakeId: true },
      },
      unitRegistrations: {
        where: { status: UnitRegistrationStatus.SELECTED },
        select: { offeringId: true, intakeId: true },
      },
    },
  },
  lecturerProfile: {
    select: {
      id: true,
      department: { select: { facultyId: true } },
      offerings: {
        select: { offeringId: true, offering: { select: { intakeId: true } } },
      },
    },
  },
} satisfies Prisma.UserSelect;

/** Prisma persistence for announcements and the calendar's source records. */
@Injectable()
export class CommunicationsRepository {
  /** Receives the shared Prisma client. */
  constructor(private readonly prisma: PrismaService) {}

  /** Loads active user roles and academic audiences for the given account. */
  async findAudienceContext(userId: string): Promise<CommunicationAudienceContext | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: audienceContextSelect,
    });
    if (user === null) {
      return null;
    }

    return {
      userId: user.id,
      roleIds: user.roles.map(({ roleId }) => roleId),
      student:
        user.studentProfile === null
          ? null
          : {
              studentId: user.studentProfile.id,
              programmeIds: user.studentProfile.programmeEnrollments.map(
                ({ programmeId }) => programmeId,
              ),
              facultyIds: user.studentProfile.programmeEnrollments.map(
                ({ programme }) => programme.department.facultyId,
              ),
              intakeIds: [
                ...user.studentProfile.intakeRegistrations.map(({ intakeId }) => intakeId),
                ...user.studentProfile.unitRegistrations.map(({ intakeId }) => intakeId),
              ],
              offeringIds: user.studentProfile.unitRegistrations.map(
                ({ offeringId }) => offeringId,
              ),
            },
      lecturer:
        user.lecturerProfile === null
          ? null
          : {
              lecturerId: user.lecturerProfile.id,
              facultyIds: [user.lecturerProfile.department.facultyId],
              intakeIds: user.lecturerProfile.offerings.map(({ offering }) => offering.intakeId),
              offeringIds: user.lecturerProfile.offerings.map(({ offeringId }) => offeringId),
            },
    };
  }

  /** Verifies that a polymorphic audience target exists and is not deleted. */
  async hasAudienceTarget(
    audienceType: CommunicationAudienceType,
    targetId: string,
  ): Promise<boolean> {
    switch (audienceType) {
      case CommunicationAudienceType.ROLE:
        return (
          (await this.prisma.role.findUnique({ where: { id: targetId }, select: { id: true } })) !==
          null
        );
      case CommunicationAudienceType.FACULTY:
        return (
          (await this.prisma.faculty.findFirst({
            where: { id: targetId, deletedAt: null },
            select: { id: true },
          })) !== null
        );
      case CommunicationAudienceType.PROGRAMME:
        return (
          (await this.prisma.programme.findFirst({
            where: {
              id: targetId,
              deletedAt: null,
              department: { is: { deletedAt: null, faculty: { is: { deletedAt: null } } } },
            },
            select: { id: true },
          })) !== null
        );
      case CommunicationAudienceType.INTAKE:
        return (
          (await this.prisma.intake.findFirst({
            where: {
              id: targetId,
              deletedAt: null,
              academicYear: { is: { deletedAt: null } },
            },
            select: { id: true },
          })) !== null
        );
      case CommunicationAudienceType.COURSE_UNIT_OFFERING:
        return (
          (await this.prisma.courseUnitOffering.findFirst({
            where: {
              id: targetId,
              status: { not: "CANCELLED" },
              courseUnit: { is: { status: "ACTIVE" } },
              intake: { is: { deletedAt: null, academicYear: { is: { deletedAt: null } } } },
            },
            select: { id: true },
          })) !== null
        );
      case CommunicationAudienceType.ALL_STUDENTS:
      case CommunicationAudienceType.ALL_LECTURERS:
        return false;
    }
  }

  /** Loads one announcement and its audience selectors for lifecycle checks. */
  findAnnouncement(id: string): Promise<AnnouncementRecord | null> {
    return this.prisma.announcement.findUnique({
      where: { id },
      select: announcementSelect,
    });
  }

  /** Returns published announcements visible to a user, pinned and newest first. */
  findPublishedAnnouncements(
    context: CommunicationAudienceContext,
    now: Date,
    limit: number,
  ): Promise<AnnouncementRecord[]> {
    const audienceWhere = getAudienceWhere(context);
    if (audienceWhere.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.PUBLISHED,
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        audiences: { some: { OR: audienceWhere } },
      },
      orderBy: [
        { isPinned: "desc" },
        { publishAt: "desc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
        { id: "asc" },
      ],
      take: limit,
      select: announcementSelect,
    });
  }

  /** Creates an announcement and all its audience selectors atomically. */
  createAnnouncement(input: {
    title: string;
    body: string;
    imageKey: string | null;
    category: CreateAnnouncementInput["category"];
    isPinned: boolean;
    sortOrder: number;
    publishAt: Date;
    expiresAt: Date | null;
    createdById: string;
    audiences: readonly CommunicationAudienceInput[];
  }): Promise<AnnouncementRecord> {
    return this.prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        imageKey: input.imageKey,
        category: input.category,
        status: AnnouncementStatus.DRAFT,
        isPinned: input.isPinned,
        sortOrder: input.sortOrder,
        publishAt: input.publishAt,
        expiresAt: input.expiresAt,
        createdById: input.createdById,
        audiences: {
          create: input.audiences.map(({ audienceType, targetId }) => ({
            audienceType,
            targetId,
          })),
        },
      },
      select: announcementSelect,
    });
  }

  /** Updates announcement fields and replaces audience selectors in one transaction. */
  updateAnnouncement(
    id: string,
    normalized: {
      title?: string;
      body?: string;
      imageKey?: string | null;
      category?: CreateAnnouncementInput["category"];
      audiences?: readonly CommunicationAudienceInput[];
      isPinned?: boolean;
      sortOrder?: number;
      publishAt?: Date;
      expiresAt?: Date | null;
    },
  ): Promise<AnnouncementRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.announcement.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current === null || current.status === AnnouncementStatus.ARCHIVED) {
        return null;
      }

      const data: Prisma.AnnouncementUpdateManyMutationInput = {
        ...(normalized.title === undefined ? {} : { title: normalized.title }),
        ...(normalized.body === undefined ? {} : { body: normalized.body }),
        ...(normalized.imageKey === undefined ? {} : { imageKey: normalized.imageKey }),
        ...(normalized.category === undefined ? {} : { category: normalized.category }),
        ...(normalized.isPinned === undefined ? {} : { isPinned: normalized.isPinned }),
        ...(normalized.sortOrder === undefined ? {} : { sortOrder: normalized.sortOrder }),
        ...(normalized.publishAt === undefined ? {} : { publishAt: normalized.publishAt }),
        ...(normalized.expiresAt === undefined ? {} : { expiresAt: normalized.expiresAt }),
      };
      const updated = await transaction.announcement.updateMany({
        where: { id, status: { not: AnnouncementStatus.ARCHIVED } },
        data,
      });
      if (updated.count !== 1) {
        return null;
      }
      if (normalized.audiences !== undefined) {
        await transaction.announcementAudience.deleteMany({ where: { announcementId: id } });
        if (normalized.audiences.length > 0) {
          await transaction.announcementAudience.createMany({
            data: normalized.audiences.map(({ audienceType, targetId }) => ({
              announcementId: id,
              audienceType,
              targetId,
            })),
          });
        }
      }
      return transaction.announcement.findUnique({
        where: { id },
        select: announcementSelect,
      });
    });
  }

  /** Changes publication state without allowing archived announcements to revive. */
  async updateAnnouncementStatus(
    id: string,
    status: AnnouncementStatus,
  ): Promise<AnnouncementRecord | null> {
    const updated = await this.prisma.announcement.updateMany({
      where:
        status === AnnouncementStatus.ARCHIVED
          ? { id }
          : { id, status: { not: AnnouncementStatus.ARCHIVED } },
      data: { status },
    });
    if (updated.count !== 1) {
      return null;
    }
    return this.findAnnouncement(id);
  }

  /** Loads authored calendar events that overlap the requested range. */
  findCalendarEvents(from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: { startsAt: { lte: to }, endsAt: { gte: from } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        audiences: { select: { audienceType: true, targetId: true } },
      },
    });
  }

  /** Loads intake date milestones relevant to a user's calendar window. */
  findIntakeCalendarSources(
    intakeIds: readonly string[],
    includeAll: boolean,
    from: Date,
    to: Date,
  ) {
    if (!includeAll && intakeIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.intake.findMany({
      where: {
        ...(includeAll ? {} : { id: { in: [...new Set(intakeIds)] } }),
        deletedAt: null,
        academicYear: { is: { deletedAt: null } },
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
          { selectionOpensAt: { gte: from, lte: to } },
          { selectionClosesAt: { gte: from, lte: to } },
        ],
      },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        selectionOpensAt: true,
        selectionClosesAt: true,
        academicYear: { select: { label: true } },
      },
    });
  }

  /** Loads sessions for the user's selected or taught offerings without link fields. */
  findCalendarSessions(offeringIds: readonly string[], from: Date, to: Date) {
    if (offeringIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.classSession.findMany({
      where: {
        offeringId: { in: [...new Set(offeringIds)] },
        status: { not: "CANCELLED" },
        startsAt: { lte: to },
        endsAt: { gte: from },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        deliveryMode: true,
        room: true,
        offering: {
          select: {
            id: true,
            courseUnit: { select: { code: true, name: true } },
          },
        },
      },
    });
  }
}
