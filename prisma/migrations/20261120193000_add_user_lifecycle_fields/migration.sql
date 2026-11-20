-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'DEACTIVATED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "createdById" UUID,
ADD COLUMN "deactivatedAt" TIMESTAMP(3),
ADD COLUMN "deactivatedById" UUID,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_temporaryPasswordExpiresAt_idx" ON "User"("temporaryPasswordExpiresAt");

-- CreateIndex
CREATE INDEX "User_createdById_idx" ON "User"("createdById");

-- CreateIndex
CREATE INDEX "User_deactivatedById_idx" ON "User"("deactivatedById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
