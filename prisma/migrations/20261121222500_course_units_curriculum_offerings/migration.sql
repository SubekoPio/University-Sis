-- CreateEnum
CREATE TYPE "CourseUnitLevel" AS ENUM (
    'LEVEL_100',
    'LEVEL_200',
    'LEVEL_300',
    'LEVEL_400'
);

-- CreateEnum
CREATE TYPE "CourseUnitStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'RETIRED'
);

-- CreateEnum
CREATE TYPE "ProgrammeCourseUnitType" AS ENUM (
    'CORE',
    'ELECTIVE'
);

-- CreateEnum
CREATE TYPE "CourseUnitOfferingStatus" AS ENUM (
    'PLANNED',
    'OPEN',
    'CLOSED',
    'CANCELLED'
);

-- CreateTable
CREATE TABLE "CourseUnit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditUnits" INTEGER NOT NULL,
    "level" "CourseUnitLevel" NOT NULL,
    "ownerDepartmentId" UUID NOT NULL,
    "isGeneral" BOOLEAN NOT NULL,
    "openToAllFaculties" BOOLEAN NOT NULL,
    "status" "CourseUnitStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseUnitFacultyEligibility" (
    "courseUnitId" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseUnitFacultyEligibility_pkey"
        PRIMARY KEY ("courseUnitId", "facultyId")
);

-- CreateTable
CREATE TABLE "ProgrammeCourseUnit" (
    "id" UUID NOT NULL,
    "programmeId" UUID NOT NULL,
    "courseUnitId" UUID NOT NULL,
    "studyYear" INTEGER NOT NULL,
    "intakeSlot" INTEGER NOT NULL,
    "type" "ProgrammeCourseUnitType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeCourseUnit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProgrammeCourseUnit_intakeSlot_check"
        CHECK ("intakeSlot" BETWEEN 1 AND 3)
);

-- CreateTable
CREATE TABLE "ProgrammeElectiveRule" (
    "id" UUID NOT NULL,
    "programmeId" UUID NOT NULL,
    "studyYear" INTEGER NOT NULL,
    "intakeSlot" INTEGER NOT NULL,
    "minCredits" INTEGER NOT NULL,
    "maxCredits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeElectiveRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProgrammeElectiveRule_intakeSlot_check"
        CHECK ("intakeSlot" BETWEEN 1 AND 3)
);

-- CreateTable
CREATE TABLE "CourseUnitPrerequisite" (
    "courseUnitId" UUID NOT NULL,
    "prerequisiteId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseUnitPrerequisite_pkey"
        PRIMARY KEY ("courseUnitId", "prerequisiteId")
);

-- CreateTable
CREATE TABLE "CourseUnitOffering" (
    "id" UUID NOT NULL,
    "courseUnitId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "capacity" INTEGER,
    "status" "CourseUnitOfferingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseUnitOffering_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseUnit_code_key" ON "CourseUnit"("code");

-- CreateIndex
CREATE INDEX "CourseUnit_ownerDepartmentId_idx"
    ON "CourseUnit"("ownerDepartmentId");

-- CreateIndex
CREATE INDEX "CourseUnit_status_level_idx"
    ON "CourseUnit"("status", "level");

-- CreateIndex
CREATE INDEX "CourseUnitFacultyEligibility_facultyId_idx"
    ON "CourseUnitFacultyEligibility"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeCourseUnit_programmeId_courseUnitId_key"
    ON "ProgrammeCourseUnit"("programmeId", "courseUnitId");

-- CreateIndex
CREATE INDEX "ProgrammeCourseUnit_programmeId_studyYear_intakeSlot_idx"
    ON "ProgrammeCourseUnit"("programmeId", "studyYear", "intakeSlot");

-- CreateIndex
CREATE INDEX "ProgrammeCourseUnit_courseUnitId_idx"
    ON "ProgrammeCourseUnit"("courseUnitId");

-- CreateIndex
CREATE INDEX "ProgrammeElectiveRule_programmeId_studyYear_intakeSlot_idx"
    ON "ProgrammeElectiveRule"("programmeId", "studyYear", "intakeSlot");

-- CreateIndex
CREATE INDEX "CourseUnitPrerequisite_prerequisiteId_idx"
    ON "CourseUnitPrerequisite"("prerequisiteId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseUnitOffering_courseUnitId_intakeId_key"
    ON "CourseUnitOffering"("courseUnitId", "intakeId");

-- CreateIndex
CREATE INDEX "CourseUnitOffering_intakeId_status_idx"
    ON "CourseUnitOffering"("intakeId", "status");

-- AddForeignKey
ALTER TABLE "CourseUnit"
    ADD CONSTRAINT "CourseUnit_ownerDepartmentId_fkey"
    FOREIGN KEY ("ownerDepartmentId") REFERENCES "Department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnitFacultyEligibility"
    ADD CONSTRAINT "CourseUnitFacultyEligibility_courseUnitId_fkey"
    FOREIGN KEY ("courseUnitId") REFERENCES "CourseUnit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnitFacultyEligibility"
    ADD CONSTRAINT "CourseUnitFacultyEligibility_facultyId_fkey"
    FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeCourseUnit"
    ADD CONSTRAINT "ProgrammeCourseUnit_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "Programme"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeCourseUnit"
    ADD CONSTRAINT "ProgrammeCourseUnit_courseUnitId_fkey"
    FOREIGN KEY ("courseUnitId") REFERENCES "CourseUnit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeElectiveRule"
    ADD CONSTRAINT "ProgrammeElectiveRule_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "Programme"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnitPrerequisite"
    ADD CONSTRAINT "CourseUnitPrerequisite_courseUnitId_fkey"
    FOREIGN KEY ("courseUnitId") REFERENCES "CourseUnit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnitPrerequisite"
    ADD CONSTRAINT "CourseUnitPrerequisite_prerequisiteId_fkey"
    FOREIGN KEY ("prerequisiteId") REFERENCES "CourseUnit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnitOffering"
    ADD CONSTRAINT "CourseUnitOffering_courseUnitId_fkey"
    FOREIGN KEY ("courseUnitId") REFERENCES "CourseUnit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseUnitOffering"
    ADD CONSTRAINT "CourseUnitOffering_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "Intake"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
