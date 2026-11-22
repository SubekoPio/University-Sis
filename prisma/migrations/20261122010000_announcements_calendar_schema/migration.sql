-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'ACADEMIC', 'FINANCE', 'EXAM', 'EVENT');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunicationAudienceType" AS ENUM ('ALL_STUDENTS', 'ALL_LECTURERS', 'ROLE', 'FACULTY', 'PROGRAMME', 'INTAKE', 'COURSE_UNIT_OFFERING');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('HOLIDAY', 'ACADEMIC', 'EVENT');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageKey" TEXT,
    "category" "AnnouncementCategory" NOT NULL,
    "status" "AnnouncementStatus" NOT NULL,
    "isPinned" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAudience" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "audienceType" "CommunicationAudienceType" NOT NULL,
    "targetId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventAudience" (
    "id" UUID NOT NULL,
    "calendarEventId" UUID NOT NULL,
    "audienceType" "CommunicationAudienceType" NOT NULL,
    "targetId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_status_publishAt_expiresAt_idx" ON "Announcement"("status", "publishAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_createdById_idx" ON "Announcement"("createdById");

-- CreateIndex
CREATE INDEX "AnnouncementAudience_announcementId_audienceType_idx" ON "AnnouncementAudience"("announcementId", "audienceType");

-- CreateIndex
CREATE INDEX "AnnouncementAudience_audienceType_targetId_idx" ON "AnnouncementAudience"("audienceType", "targetId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startsAt_endsAt_idx" ON "CalendarEvent"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_type_startsAt_idx" ON "CalendarEvent"("type", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdById_idx" ON "CalendarEvent"("createdById");

-- CreateIndex
CREATE INDEX "CalendarEventAudience_calendarEventId_audienceType_idx" ON "CalendarEventAudience"("calendarEventId", "audienceType");

-- CreateIndex
CREATE INDEX "CalendarEventAudience_audienceType_targetId_idx" ON "CalendarEventAudience"("audienceType", "targetId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAudience" ADD CONSTRAINT "AnnouncementAudience_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventAudience" ADD CONSTRAINT "CalendarEventAudience_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
