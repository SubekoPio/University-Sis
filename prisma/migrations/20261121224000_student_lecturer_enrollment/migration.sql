-- CreateEnum
CREATE TYPE "StudentSchedule" AS ENUM (
    'DAY',
    'EVENING',
    'WEEKEND',
    'DISTANCE'
);

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM (
    'PHYSICAL',
    'ONLINE',
    'HYBRID'
);

-- CreateEnum
CREATE TYPE "OfferingLecturerRole" AS ENUM (
    'PRIMARY',
    'ASSISTANT'
);

-- CreateEnum
CREATE TYPE "ProgrammeEnrollmentStatus" AS ENUM (
    'ACTIVE',
    'DEFERRED',
    'COMPLETED',
    'WITHDRAWN'
);

-- CreateEnum
CREATE TYPE "IntakeRegistrationStatus" AS ENUM (
    'PENDING',
    'REGISTERED',
    'DEFERRED',
    'WITHDRAWN',
    'SUSPENDED',
    'COMPLETED'
);

-- CreateEnum
CREATE TYPE "UnitRegistrationStatus" AS ENUM (
    'SELECTED',
    'DROPPED',
    'COMPLETED'
);

-- AlterTable
ALTER TABLE "CourseUnitOffering"
    ADD COLUMN "deliveryMode" "DeliveryMode" NOT NULL;

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "nationality" TEXT,
    "nationalId" TEXT,
    "address" TEXT,
    "nextOfKinName" TEXT,
    "nextOfKinPhone" TEXT,
    "nextOfKinRelationship" TEXT,
    "schedule" "StudentSchedule" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecturer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "staffNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lecturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferingLecturer" (
    "offeringId" UUID NOT NULL,
    "lecturerId" UUID NOT NULL,
    "role" "OfferingLecturerRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferingLecturer_pkey" PRIMARY KEY ("offeringId", "lecturerId")
);

-- CreateTable
CREATE TABLE "ProgrammeEnrollment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "programmeId" UUID NOT NULL,
    "admissionIntakeId" UUID NOT NULL,
    "currentStudyYear" INTEGER NOT NULL,
    "currentIntakeSlot" INTEGER NOT NULL,
    "status" "ProgrammeEnrollmentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeEnrollment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProgrammeEnrollment_currentIntakeSlot_check"
        CHECK ("currentIntakeSlot" BETWEEN 1 AND 3)
);

-- CreateTable
CREATE TABLE "IntakeRegistration" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "status" "IntakeRegistrationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitRegistration" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "status" "UnitRegistrationStatus" NOT NULL,
    "isRetake" BOOLEAN NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_nationalId_key" ON "Student"("nationalId");

-- CreateIndex
CREATE INDEX "Student_schedule_idx" ON "Student"("schedule");

-- CreateIndex
CREATE UNIQUE INDEX "Lecturer_userId_key" ON "Lecturer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Lecturer_staffNumber_key" ON "Lecturer"("staffNumber");

-- CreateIndex
CREATE INDEX "Lecturer_departmentId_idx" ON "Lecturer"("departmentId");

-- CreateIndex
CREATE INDEX "OfferingLecturer_lecturerId_idx"
    ON "OfferingLecturer"("lecturerId");

-- CreateIndex
CREATE INDEX "ProgrammeEnrollment_studentId_status_idx"
    ON "ProgrammeEnrollment"("studentId", "status");

-- CreateIndex
CREATE INDEX "ProgrammeEnrollment_studentId_createdAt_idx"
    ON "ProgrammeEnrollment"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgrammeEnrollment_programmeId_status_idx"
    ON "ProgrammeEnrollment"("programmeId", "status");

-- CreateIndex
CREATE INDEX "ProgrammeEnrollment_admissionIntakeId_idx"
    ON "ProgrammeEnrollment"("admissionIntakeId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeRegistration_studentId_intakeId_key"
    ON "IntakeRegistration"("studentId", "intakeId");

-- CreateIndex
CREATE INDEX "IntakeRegistration_intakeId_status_idx"
    ON "IntakeRegistration"("intakeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UnitRegistration_studentId_offeringId_key"
    ON "UnitRegistration"("studentId", "offeringId");

-- CreateIndex
CREATE INDEX "UnitRegistration_studentId_status_idx"
    ON "UnitRegistration"("studentId", "status");

-- CreateIndex
CREATE INDEX "UnitRegistration_offeringId_status_idx"
    ON "UnitRegistration"("offeringId", "status");

-- CreateIndex
CREATE INDEX "UnitRegistration_intakeId_status_idx"
    ON "UnitRegistration"("intakeId", "status");

-- AddForeignKey
ALTER TABLE "Student"
    ADD CONSTRAINT "Student_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecturer"
    ADD CONSTRAINT "Lecturer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecturer"
    ADD CONSTRAINT "Lecturer_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingLecturer"
    ADD CONSTRAINT "OfferingLecturer_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "CourseUnitOffering"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingLecturer"
    ADD CONSTRAINT "OfferingLecturer_lecturerId_fkey"
    FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeEnrollment"
    ADD CONSTRAINT "ProgrammeEnrollment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeEnrollment"
    ADD CONSTRAINT "ProgrammeEnrollment_programmeId_fkey"
    FOREIGN KEY ("programmeId") REFERENCES "Programme"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeEnrollment"
    ADD CONSTRAINT "ProgrammeEnrollment_admissionIntakeId_fkey"
    FOREIGN KEY ("admissionIntakeId") REFERENCES "Intake"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRegistration"
    ADD CONSTRAINT "IntakeRegistration_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRegistration"
    ADD CONSTRAINT "IntakeRegistration_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "Intake"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRegistration"
    ADD CONSTRAINT "UnitRegistration_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRegistration"
    ADD CONSTRAINT "UnitRegistration_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "CourseUnitOffering"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitRegistration"
    ADD CONSTRAINT "UnitRegistration_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "Intake"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
