// Purpose: Define announcement inputs and safe service response shapes.
import type { AnnouncementCategory, AnnouncementStatus, Prisma } from "@prisma/client";
import type { CommunicationAudienceInput } from "./communications.types.js";

/** Raster image supplied for announcement storage. */
export interface AnnouncementImageInput {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

/** Fields used to create a draft announcement. */
export interface CreateAnnouncementInput {
  title: string;
  body: string;
  category: AnnouncementCategory;
  audiences: readonly CommunicationAudienceInput[];
  image?: AnnouncementImageInput;
  isPinned?: boolean;
  sortOrder?: number;
  publishAt?: Date;
  expiresAt?: Date | null;
}

/** Editable announcement fields; `null` explicitly clears the image or expiry. */
export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  category?: AnnouncementCategory;
  audiences?: readonly CommunicationAudienceInput[];
  image?: AnnouncementImageInput | null;
  isPinned?: boolean;
  sortOrder?: number;
  publishAt?: Date;
  expiresAt?: Date | null;
}

/** Announcement row used internally by lifecycle and audience workflows. */
export type AnnouncementRecord = Prisma.AnnouncementGetPayload<{
  select: {
    id: true;
    title: true;
    body: true;
    imageKey: true;
    category: true;
    status: true;
    isPinned: true;
    sortOrder: true;
    publishAt: true;
    expiresAt: true;
    createdById: true;
    createdAt: true;
    updatedAt: true;
    audiences: { select: { audienceType: true; targetId: true } };
  };
}>;

/** Safe announcement result with a short-lived URL instead of its object key. */
export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  category: AnnouncementCategory;
  status: AnnouncementStatus;
  isPinned: boolean;
  sortOrder: number;
  publishAt: Date;
  expiresAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  audiences: CommunicationAudienceInput[];
}
