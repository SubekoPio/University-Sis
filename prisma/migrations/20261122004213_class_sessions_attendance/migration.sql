-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PresenceIntervalSource" AS ENUM ('PROVIDER_WEBHOOK', 'REPORT_IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('ONLINE_PRESENCE', 'LECTURER_MARKED');

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "room" TEXT,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "defaultMeetingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "slotId" UUID,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "room" TEXT,
    "meetingUrl" TEXT,
    "meetingProvider" TEXT,
    "externalMeetingId" TEXT,
    "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionJoin" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionJoin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceInterval" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3) NOT NULL,
    "source" "PresenceIntervalSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "longestContinuousSeconds" INTEGER NOT NULL,
    "totalSeconds" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "overriddenById" UUID,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRule" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "minContinuousPercent" INTEGER NOT NULL DEFAULT 75,
    "reconnectGraceSeconds" INTEGER NOT NULL DEFAULT 180,
    "minAttendancePercentWarning" INTEGER NOT NULL DEFAULT 75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableSlot_offeringId_dayOfWeek_idx" ON "TimetableSlot"("offeringId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ClassSession_offeringId_startsAt_idx" ON "ClassSession"("offeringId", "startsAt");

-- CreateIndex
CREATE INDEX "ClassSession_status_startsAt_idx" ON "ClassSession"("status", "startsAt");

-- CreateIndex
CREATE INDEX "ClassSession_slotId_idx" ON "ClassSession"("slotId");

-- CreateIndex
CREATE INDEX "SessionJoin_sessionId_clickedAt_idx" ON "SessionJoin"("sessionId", "clickedAt");

-- CreateIndex
CREATE INDEX "SessionJoin_studentId_clickedAt_idx" ON "SessionJoin"("studentId", "clickedAt");

-- CreateIndex
CREATE INDEX "PresenceInterval_sessionId_studentId_joinedAt_idx" ON "PresenceInterval"("sessionId", "studentId", "joinedAt");

-- CreateIndex
CREATE INDEX "PresenceInterval_studentId_joinedAt_idx" ON "PresenceInterval"("studentId", "joinedAt");

-- CreateIndex
CREATE INDEX "PresenceInterval_source_idx" ON "PresenceInterval"("source");

-- CreateIndex
CREATE INDEX "AttendanceRecord_sessionId_status_idx" ON "AttendanceRecord"("sessionId", "status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_status_idx" ON "AttendanceRecord"("studentId", "status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_overriddenById_idx" ON "AttendanceRecord"("overriddenById");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseUnitOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseUnitOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionJoin" ADD CONSTRAINT "SessionJoin_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionJoin" ADD CONSTRAINT "SessionJoin_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceInterval" ADD CONSTRAINT "PresenceInterval_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceInterval" ADD CONSTRAINT "PresenceInterval_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce the single system-wide attendance-rule configuration row.
ALTER TABLE "AttendanceRule"
ADD CONSTRAINT "AttendanceRule_singleton_id_check" CHECK ("id" = 1);
