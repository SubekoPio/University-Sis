// Purpose: Manage audience-scoped announcements and store safe private artwork.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AnnouncementCategory,
  AnnouncementStatus,
  CommunicationAudienceType,
} from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { StorageService } from "../storage/storage.service.js";
import { normalizeRequiredText } from "./academic.validation.js";
import { CommunicationsRepository } from "./communications.repository.js";
import type {
  AnnouncementImageInput,
  AnnouncementRecord,
  AnnouncementView,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "./announcements.types.js";
import type {
  CommunicationAudienceContext,
  CommunicationAudienceInput,
} from "./communications.types.js";
import { TimetableRepository } from "./timetable.repository.js";

const ANNOUNCEMENT_MANAGE_PERMISSION = "announcements:manage";
const ANNOUNCEMENT_POST_OWN_PERMISSION = "announcements:post-own";
const MAX_ANNOUNCEMENT_LIMIT = 100;
const allowedBodyTags = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h2",
  "h3",
  "a",
];
const bodySanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: allowedBodyTags,
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

interface AnnouncementActor {
  userId: string;
  canManageAll: boolean;
  context: CommunicationAudienceContext;
}

/** Provides permission-scoped announcement lifecycle and audience-feed operations. */
@Injectable()
export class AnnouncementsService {
  /** Receives announcement persistence, RBAC, storage, and lecturer assignment services. */
  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly rbac: RbacService,
    private readonly storage: StorageService,
    private readonly timetableRepository: TimetableRepository,
  ) {}

  /** Creates a draft announcement after validating its audience and content. */
  async create(input: CreateAnnouncementInput, actorId: string): Promise<AnnouncementView> {
    const actor = await this.getAnnouncementActor(actorId);
    const normalized = this.normalizeCreateInput(input);
    await this.validateAudiences(normalized.audiences, actor);
    let imageKey: string | null = null;
    if (normalized.image !== undefined) {
      imageKey = await this.storage.storeAnnouncementImage(normalized.image);
    }

    let announcement: AnnouncementRecord;
    try {
      announcement = await this.repository.createAnnouncement({
        title: normalized.title,
        body: normalized.body,
        category: normalized.category,
        audiences: normalized.audiences,
        isPinned: normalized.isPinned,
        sortOrder: normalized.sortOrder,
        publishAt: normalized.publishAt,
        expiresAt: normalized.expiresAt,
        imageKey,
        createdById: actor.userId,
      });
    } catch (error: unknown) {
      if (imageKey !== null) {
        await this.cleanupAfterFailure(imageKey, error);
      }
      throw error;
    }
    return this.toView(announcement);
  }

  /** Updates a non-archived announcement and replaces only the supplied fields. */
  async update(
    announcementId: string,
    input: UpdateAnnouncementInput,
    actorId: string,
  ): Promise<AnnouncementView> {
    const actor = await this.getAnnouncementActor(actorId);
    const id = this.validateUuid(announcementId, "Announcement ID");
    const current = await this.getAnnouncement(id);
    this.assertCanManageAnnouncement(current, actor);
    if (current.status === AnnouncementStatus.ARCHIVED) {
      throw new ConflictException("An archived announcement cannot be updated.");
    }

    const normalized = this.normalizeUpdateInput(input);
    const audiences = normalized.audiences ?? current.audiences;
    await this.validateAudiences(audiences, actor);
    this.validatePublicationWindow(
      normalized.publishAt ?? current.publishAt,
      normalized.expiresAt === undefined ? current.expiresAt : normalized.expiresAt,
    );

    let imageKey: string | null | undefined;
    if (normalized.image !== undefined) {
      imageKey =
        normalized.image === null
          ? null
          : await this.storage.storeAnnouncementImage(normalized.image);
    }
    const updateData = {
      ...(normalized.title === undefined ? {} : { title: normalized.title }),
      ...(normalized.body === undefined ? {} : { body: normalized.body }),
      ...(normalized.category === undefined ? {} : { category: normalized.category }),
      ...(normalized.audiences === undefined ? {} : { audiences: normalized.audiences }),
      ...(normalized.isPinned === undefined ? {} : { isPinned: normalized.isPinned }),
      ...(normalized.sortOrder === undefined ? {} : { sortOrder: normalized.sortOrder }),
      ...(normalized.publishAt === undefined ? {} : { publishAt: normalized.publishAt }),
      ...(normalized.expiresAt === undefined ? {} : { expiresAt: normalized.expiresAt }),
      ...(imageKey === undefined ? {} : { imageKey }),
    };
    let updated: AnnouncementRecord | null;
    try {
      updated = await this.repository.updateAnnouncement(id, updateData);
    } catch (error: unknown) {
      if (typeof imageKey === "string") {
        await this.cleanupAfterFailure(imageKey, error);
      }
      throw error;
    }
    if (updated === null) {
      if (typeof imageKey === "string") {
        await this.storage.deleteObject(imageKey);
      }
      throw new ConflictException("The announcement changed or was archived before the update.");
    }
    if (current.imageKey !== null && imageKey !== undefined && current.imageKey !== imageKey) {
      await this.storage.deleteObject(current.imageKey);
    }
    return this.toView(updated);
  }

  /** Publishes a draft or already-published announcement without reviving archives. */
  async publish(announcementId: string, actorId: string): Promise<AnnouncementView> {
    const actor = await this.getAnnouncementActor(actorId);
    const id = this.validateUuid(announcementId, "Announcement ID");
    const current = await this.getAnnouncement(id);
    this.assertCanManageAnnouncement(current, actor);
    if (current.status === AnnouncementStatus.ARCHIVED) {
      throw new ConflictException("An archived announcement cannot be published.");
    }
    if (current.status === AnnouncementStatus.PUBLISHED) {
      return this.toView(current);
    }
    const published = await this.repository.updateAnnouncementStatus(
      id,
      AnnouncementStatus.PUBLISHED,
    );
    if (published === null) {
      throw new ConflictException("The announcement changed before it could be published.");
    }
    return this.toView(published);
  }

  /** Archives an announcement; its content and image remain available as history. */
  async archive(announcementId: string, actorId: string): Promise<AnnouncementView> {
    const actor = await this.getAnnouncementActor(actorId);
    const id = this.validateUuid(announcementId, "Announcement ID");
    const current = await this.getAnnouncement(id);
    this.assertCanManageAnnouncement(current, actor);
    if (current.status === AnnouncementStatus.ARCHIVED) {
      return this.toView(current);
    }
    const archived = await this.repository.updateAnnouncementStatus(
      id,
      AnnouncementStatus.ARCHIVED,
    );
    if (archived === null) {
      throw new ConflictException("The announcement changed before it could be archived.");
    }
    return this.toView(archived);
  }

  /** Returns published, unexpired announcements visible to a user, pinned then newest. */
  async getForUser(userId: string, limit: number): Promise<AnnouncementView[]> {
    const targetUserId = this.validateUuid(userId, "User ID");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ANNOUNCEMENT_LIMIT) {
      throw new BadRequestException(
        `Announcement limit must be from 1 to ${MAX_ANNOUNCEMENT_LIMIT}.`,
      );
    }
    const context = await this.repository.findAudienceContext(targetUserId);
    if (context === null) {
      throw new NotFoundException("Active user not found.");
    }
    const announcements = await this.repository.findPublishedAnnouncements(
      context,
      new Date(),
      limit,
    );
    return Promise.all(announcements.map((announcement) => this.toView(announcement)));
  }

  private async getAnnouncementActor(actorId: string): Promise<AnnouncementActor> {
    const userId = this.validateUuid(actorId, "Actor ID");
    const [context, authorization] = await Promise.all([
      this.repository.findAudienceContext(userId),
      this.rbac.getAuthorizationSnapshot(userId),
    ]);
    if (context === null) {
      throw new ForbiddenException("An active account with announcement permissions is required.");
    }
    const canManageAll = authorization.permissions.includes(ANNOUNCEMENT_MANAGE_PERMISSION);
    if (!canManageAll && !authorization.permissions.includes(ANNOUNCEMENT_POST_OWN_PERMISSION)) {
      throw new ForbiddenException(
        `The ${ANNOUNCEMENT_MANAGE_PERMISSION} or ${ANNOUNCEMENT_POST_OWN_PERMISSION} permission is required.`,
      );
    }
    return { userId, canManageAll, context };
  }

  private async getAnnouncement(id: string): Promise<AnnouncementRecord> {
    const announcement = await this.repository.findAnnouncement(id);
    if (announcement === null) {
      throw new NotFoundException("Announcement not found.");
    }
    return announcement;
  }

  private assertCanManageAnnouncement(
    announcement: AnnouncementRecord,
    actor: AnnouncementActor,
  ): void {
    if (actor.canManageAll) {
      return;
    }
    if (announcement.createdById !== actor.userId) {
      throw new ForbiddenException("Lecturers may manage only announcements they created.");
    }
    const offeringIds = announcement.audiences
      .filter(({ audienceType }) => audienceType === CommunicationAudienceType.COURSE_UNIT_OFFERING)
      .map(({ targetId }) => targetId)
      .filter((targetId): targetId is string => targetId !== null);
    if (
      announcement.audiences.length === 0 ||
      offeringIds.length !== announcement.audiences.length ||
      !offeringIds.every((offeringId) => actor.context.lecturer?.offeringIds.includes(offeringId))
    ) {
      throw new ForbiddenException(
        "Lecturers may manage announcements only for their own offerings.",
      );
    }
  }

  private async validateAudiences(
    audiences: readonly CommunicationAudienceInput[],
    actor: AnnouncementActor,
  ): Promise<void> {
    if (!Array.isArray(audiences) || audiences.length === 0) {
      throw new BadRequestException("At least one announcement audience is required.");
    }
    const seen = new Set<string>();
    for (const audience of audiences) {
      if (!Object.values(CommunicationAudienceType).includes(audience.audienceType)) {
        throw new BadRequestException("The announcement audience type is invalid.");
      }
      const targetRequired =
        audience.audienceType !== CommunicationAudienceType.ALL_STUDENTS &&
        audience.audienceType !== CommunicationAudienceType.ALL_LECTURERS;
      if (targetRequired !== (audience.targetId !== null)) {
        throw new BadRequestException("The selected announcement audience has an invalid target.");
      }
      if (
        !actor.canManageAll &&
        audience.audienceType !== CommunicationAudienceType.COURSE_UNIT_OFFERING
      ) {
        throw new ForbiddenException("Lecturers may post only to their own course-unit offerings.");
      }
      if (audience.targetId !== null) {
        const targetId = this.validateUuid(audience.targetId, "Audience target ID");
        if (!(await this.repository.hasAudienceTarget(audience.audienceType, targetId))) {
          throw new BadRequestException(
            "The selected announcement audience target is unavailable.",
          );
        }
        if (
          !actor.canManageAll &&
          !(await this.timetableRepository.isLecturerAssignedToOffering(actor.userId, targetId))
        ) {
          throw new ForbiddenException(
            "Lecturers may post only to their own course-unit offerings.",
          );
        }
      }
      const key = `${audience.audienceType}:${audience.targetId ?? ""}`;
      if (seen.has(key)) {
        throw new BadRequestException("Announcement audience selectors must be unique.");
      }
      seen.add(key);
    }
  }

  private normalizeCreateInput(input: CreateAnnouncementInput): {
    title: string;
    body: string;
    category: AnnouncementCategory;
    audiences: readonly CommunicationAudienceInput[];
    image?: AnnouncementImageInput;
    isPinned: boolean;
    sortOrder: number;
    publishAt: Date;
    expiresAt: Date | null;
  } {
    if (!Array.isArray(input.audiences)) {
      throw new BadRequestException("Announcement audiences must be provided as a list.");
    }
    if (!Object.values(AnnouncementCategory).includes(input.category)) {
      throw new BadRequestException("The announcement category is invalid.");
    }
    const title = normalizeRequiredText(input.title, "Announcement title");
    const body = this.sanitizeBody(input.body);
    const publishAt =
      input.publishAt === undefined ? new Date() : this.validateDate(input.publishAt);
    const expiresAt = input.expiresAt ?? null;
    this.validatePublicationWindow(publishAt, expiresAt);
    this.validateOrder(input.sortOrder ?? 0);
    return {
      title,
      body,
      category: input.category,
      audiences: input.audiences,
      ...(input.image === undefined ? {} : { image: input.image }),
      isPinned: input.isPinned ?? false,
      sortOrder: input.sortOrder ?? 0,
      publishAt,
      expiresAt,
    };
  }

  private normalizeUpdateInput(input: UpdateAnnouncementInput): {
    title?: string;
    body?: string;
    category?: AnnouncementCategory;
    audiences?: readonly CommunicationAudienceInput[];
    image?: AnnouncementImageInput | null;
    isPinned?: boolean;
    sortOrder?: number;
    publishAt?: Date;
    expiresAt?: Date | null;
  } {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException("At least one announcement field must be provided.");
    }
    if (
      input.category !== undefined &&
      !Object.values(AnnouncementCategory).includes(input.category)
    ) {
      throw new BadRequestException("The announcement category is invalid.");
    }
    if (input.sortOrder !== undefined) {
      this.validateOrder(input.sortOrder);
    }
    return {
      ...(input.title === undefined
        ? {}
        : { title: normalizeRequiredText(input.title, "Announcement title") }),
      ...(input.body === undefined ? {} : { body: this.sanitizeBody(input.body) }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.audiences === undefined ? {} : { audiences: input.audiences }),
      ...(input.image === undefined ? {} : { image: input.image }),
      ...(input.isPinned === undefined ? {} : { isPinned: input.isPinned }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      ...(input.publishAt === undefined ? {} : { publishAt: this.validateDate(input.publishAt) }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    };
  }

  private sanitizeBody(value: string): string {
    if (typeof value !== "string") {
      throw new BadRequestException("Announcement body is required.");
    }
    const sanitized = sanitizeHtml(value, bodySanitizerOptions).trim();
    const text = sanitizeHtml(sanitized, { allowedTags: [], allowedAttributes: {} }).trim();
    if (text.length === 0) {
      throw new BadRequestException("Announcement body must contain readable content.");
    }
    return sanitized;
  }

  private validatePublicationWindow(publishAt: Date, expiresAt: Date | null): void {
    this.validateDate(publishAt);
    if (expiresAt !== null) {
      this.validateDate(expiresAt);
      if (expiresAt.getTime() <= publishAt.getTime()) {
        throw new BadRequestException("Announcement expiry must be after its publication time.");
      }
    }
  }

  private validateDate(value: Date): Date {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new BadRequestException("Announcement publication dates must be valid.");
    }
    return value;
  }

  private validateOrder(value: number): void {
    if (!Number.isSafeInteger(value)) {
      throw new BadRequestException("Announcement sort order must be a whole number.");
    }
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }

  private async cleanupAfterFailure(storageKey: string, cause: unknown): Promise<void> {
    try {
      await this.storage.deleteObject(storageKey);
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [cause, cleanupError],
        "Announcement persistence failed and its uploaded image could not be removed.",
        { cause: cleanupError },
      );
    }
  }

  private async toView(announcement: AnnouncementRecord): Promise<AnnouncementView> {
    return {
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      imageUrl:
        announcement.imageKey === null
          ? null
          : await this.storage.getReadUrl(announcement.imageKey),
      category: announcement.category,
      status: announcement.status,
      isPinned: announcement.isPinned,
      sortOrder: announcement.sortOrder,
      publishAt: announcement.publishAt,
      expiresAt: announcement.expiresAt,
      createdById: announcement.createdById,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
      audiences: announcement.audiences,
    };
  }
}
