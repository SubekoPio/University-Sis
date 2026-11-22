-- Add soft-delete timestamps to academic structure records.
ALTER TABLE "Faculty" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Department" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Programme" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "AcademicYear" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Intake" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Faculty_deletedAt_idx" ON "Faculty"("deletedAt");
CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");
CREATE INDEX "Programme_deletedAt_idx" ON "Programme"("deletedAt");
CREATE INDEX "AcademicYear_deletedAt_idx" ON "AcademicYear"("deletedAt");
CREATE INDEX "Intake_deletedAt_idx" ON "Intake"("deletedAt");
