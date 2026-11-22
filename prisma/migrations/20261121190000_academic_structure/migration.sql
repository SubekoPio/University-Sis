-- CreateEnum
CREATE TYPE "AwardLevel" AS ENUM (
    'CERTIFICATE',
    'DIPLOMA',
    'BACHELOR',
    'POSTGRADUATE_DIPLOMA',
    'MASTERS',
    'DOCTORATE'
);

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM (
    'UPCOMING',
    'SELECTION_OPEN',
    'ACTIVE',
    'CLOSED'
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "awardLevel" "AwardLevel" NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intake" (
    "id" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "selectionOpensAt" TIMESTAMP(3) NOT NULL,
    "selectionClosesAt" TIMESTAMP(3) NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Intake_sequence_range_check" CHECK ("sequence" BETWEEN 1 AND 3)
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_code_key" ON "Faculty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_facultyId_idx" ON "Department"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_code_key" ON "Programme"("code");

-- CreateIndex
CREATE INDEX "Programme_departmentId_idx" ON "Programme"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_label_key" ON "AcademicYear"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Intake_academicYearId_sequence_key"
    ON "Intake"("academicYearId", "sequence");

-- CreateIndex
CREATE INDEX "Intake_status_selectionOpensAt_selectionClosesAt_idx"
    ON "Intake"("status", "selectionOpensAt", "selectionClosesAt");

-- AddForeignKey
ALTER TABLE "Department"
    ADD CONSTRAINT "Department_facultyId_fkey"
    FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme"
    ADD CONSTRAINT "Programme_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake"
    ADD CONSTRAINT "Intake_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
