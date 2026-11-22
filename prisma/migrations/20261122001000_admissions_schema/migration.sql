-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('ONLINE', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('WEBSITE', 'ADMISSION_OFFICE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'DOCS_APPROVED', 'DOCS_REJECTED', 'FEE_CONFIRMED', 'ADMITTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationDocumentType" AS ENUM ('ID', 'TRANSCRIPT', 'CERTIFICATE', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplicationFeeStatus" AS ENUM ('RECORDED', 'VOIDED');

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "applicantName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "nationality" TEXT NOT NULL,
    "studyMode" "StudyMode" NOT NULL,
    "schedule" "StudentSchedule" NOT NULL,
    "desiredProgrammeId" UUID NOT NULL,
    "desiredIntakeId" UUID NOT NULL,
    "source" "ApplicationSource" NOT NULL,
    "externalRef" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "enteredById" UUID,
    "admittedById" UUID,
    "admittedAt" TIMESTAMP(3),
    "studentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "type" "ApplicationDocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "ApplicationDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationFeeRecord" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankReference" TEXT NOT NULL,
    "depositDate" DATE NOT NULL,
    "recordedById" UUID NOT NULL,
    "status" "ApplicationFeeStatus" NOT NULL DEFAULT 'RECORDED',
    "voidedAt" TIMESTAMP(3),
    "voidedById" UUID,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFeeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionRecord" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "programmeId" UUID NOT NULL,
    "admissionIntakeId" UUID NOT NULL,
    "studyMode" "StudyMode" NOT NULL,
    "schedule" "StudentSchedule" NOT NULL,
    "admittedById" UUID NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_externalRef_key" ON "Application"("externalRef");

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE INDEX "Application_applicantName_idx" ON "Application"("applicantName");

-- CreateIndex
CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Application_desiredIntakeId_status_idx" ON "Application"("desiredIntakeId", "status");

-- CreateIndex
CREATE INDEX "Application_desiredProgrammeId_idx" ON "Application"("desiredProgrammeId");

-- CreateIndex
CREATE INDEX "Application_enteredById_idx" ON "Application"("enteredById");

-- CreateIndex
CREATE INDEX "Application_admittedById_idx" ON "Application"("admittedById");

-- CreateIndex
CREATE INDEX "Application_studentId_idx" ON "Application"("studentId");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_status_idx" ON "ApplicationDocument"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationDocument_reviewedById_idx" ON "ApplicationDocument"("reviewedById");

-- CreateIndex
CREATE INDEX "ApplicationFeeRecord_applicationId_status_idx" ON "ApplicationFeeRecord"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationFeeRecord_recordedById_idx" ON "ApplicationFeeRecord"("recordedById");

-- CreateIndex
CREATE INDEX "ApplicationFeeRecord_voidedById_idx" ON "ApplicationFeeRecord"("voidedById");

-- CreateIndex
CREATE INDEX "ApplicationFeeRecord_depositDate_idx" ON "ApplicationFeeRecord"("depositDate");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFeeRecord_bankName_bankReference_key" ON "ApplicationFeeRecord"("bankName", "bankReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionRecord_applicationId_key" ON "AdmissionRecord"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionRecord_studentId_idx" ON "AdmissionRecord"("studentId");

-- CreateIndex
CREATE INDEX "AdmissionRecord_programmeId_admissionIntakeId_idx" ON "AdmissionRecord"("programmeId", "admissionIntakeId");

-- CreateIndex
CREATE INDEX "AdmissionRecord_admittedAt_idx" ON "AdmissionRecord"("admittedAt");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_desiredProgrammeId_fkey" FOREIGN KEY ("desiredProgrammeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_desiredIntakeId_fkey" FOREIGN KEY ("desiredIntakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_admittedById_fkey" FOREIGN KEY ("admittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFeeRecord" ADD CONSTRAINT "ApplicationFeeRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFeeRecord" ADD CONSTRAINT "ApplicationFeeRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFeeRecord" ADD CONSTRAINT "ApplicationFeeRecord_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_admissionIntakeId_fkey" FOREIGN KEY ("admissionIntakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRecord" ADD CONSTRAINT "AdmissionRecord_admittedById_fkey" FOREIGN KEY ("admittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
