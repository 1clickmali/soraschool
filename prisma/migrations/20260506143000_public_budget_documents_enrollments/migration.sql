-- CreateEnum
CREATE TYPE "DocumentFolderCategory" AS ENUM ('DIRECTION', 'ACCOUNTING', 'SECRETARIAT', 'TEACHERS', 'CLASSES', 'STUDENTS', 'PARENTS', 'CONTRACTS', 'INVOICES', 'RECEIPTS', 'REPORT_CARDS', 'ENROLLMENT_FORMS', 'REPORTS', 'OFFICIAL_DOCUMENTS', 'BUDGET', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentPermissionLevel" AS ENUM ('READ', 'WRITE', 'DELETE', 'SHARE', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "BudgetRequestStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'REFUSED', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('REPAIR', 'EVENT', 'SUPPLIES', 'BUILDING', 'IT', 'TRANSPORT', 'EMERGENCY', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'REFUSED', 'CANCELED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "PublicPlanOrderStatus" AS ENUM ('NEW', 'CONTACTED', 'INVOICE_SENT', 'PAID', 'CANCELED');

-- AlterEnum
ALTER TYPE "StaffAttendanceStatus" ADD VALUE 'OFF_SCHEDULE_JUSTIFIED';

-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" "DocumentFolderCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "StaffAttendance" ADD COLUMN     "noScheduleReason" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'VALIDATED',
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedById" TEXT,
ADD COLUMN     "validationComment" TEXT;

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "academicYearLabel" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "createdById" TEXT,
    "validatedById" TEXT,
    "rejectedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "directorComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocumentFolderCategory" NOT NULL DEFAULT 'OTHER',
    "parentFolderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPermission" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "DocumentPermissionLevel" NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL DEFAULT 'OTHER',
    "amountRequested" INTEGER NOT NULL,
    "amountApproved" INTEGER,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "urgency" "BudgetUrgency" NOT NULL DEFAULT 'NORMAL',
    "desiredDate" TIMESTAMP(3),
    "status" "BudgetRequestStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "attachmentUrl" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "paidById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "directorComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicPlanOrder" (
    "id" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL,
    "planCode" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolSlug" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Côte d''Ivoire',
    "city" TEXT,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "whatsapp" TEXT,
    "message" TEXT,
    "installationFee" INTEGER NOT NULL,
    "annualPrice" INTEGER NOT NULL,
    "totalFirstYear" INTEGER NOT NULL,
    "status" "PublicPlanOrderStatus" NOT NULL DEFAULT 'NEW',
    "institutionId" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicPlanOrder_pkey" PRIMARY KEY ("id")
);

-- Backfill public school codes from existing slugs.
UPDATE "Institution"
SET "code" = "slug"
WHERE "code" IS NULL;

-- Keep existing files classified without losing historical uploads.
INSERT INTO "DocumentFolder" ("id", "institutionId", "name", "category", "createdAt", "updatedAt")
SELECT
    'default-folder-' || md5("institutionId"),
    "institutionId",
    'Non classés',
    'OTHER',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Document"
GROUP BY "institutionId"
ON CONFLICT DO NOTHING;

UPDATE "Document" d
SET "folderId" = f."id"
FROM "DocumentFolder" f
WHERE d."institutionId" = f."institutionId"
  AND f."name" = 'Non classés'
  AND d."folderId" IS NULL;

-- CreateIndex
CREATE INDEX "Enrollment_institutionId_status_createdAt_idx" ON "Enrollment"("institutionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Enrollment_createdById_idx" ON "Enrollment"("createdById");

-- CreateIndex
CREATE INDEX "Enrollment_validatedById_idx" ON "Enrollment"("validatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_institutionId_studentId_academicYearLabel_key" ON "Enrollment"("institutionId", "studentId", "academicYearLabel");

-- CreateIndex
CREATE INDEX "DocumentFolder_institutionId_category_idx" ON "DocumentFolder"("institutionId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFolder_institutionId_parentFolderId_name_key" ON "DocumentFolder"("institutionId", "parentFolderId", "name");

-- CreateIndex
CREATE INDEX "DocumentPermission_institutionId_userId_idx" ON "DocumentPermission"("institutionId", "userId");

-- CreateIndex
CREATE INDEX "DocumentPermission_documentId_idx" ON "DocumentPermission"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPermission_documentId_userId_permission_key" ON "DocumentPermission"("documentId", "userId", "permission");

-- CreateIndex
CREATE INDEX "BudgetRequest_institutionId_status_createdAt_idx" ON "BudgetRequest"("institutionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetRequest_institutionId_category_idx" ON "BudgetRequest"("institutionId", "category");

-- CreateIndex
CREATE INDEX "BudgetRequest_requestedById_idx" ON "BudgetRequest"("requestedById");

-- CreateIndex
CREATE INDEX "PublicPlanOrder_status_createdAt_idx" ON "PublicPlanOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PublicPlanOrder_phone_idx" ON "PublicPlanOrder"("phone");

-- CreateIndex
CREATE INDEX "PublicPlanOrder_institutionId_idx" ON "PublicPlanOrder"("institutionId");

-- CreateIndex
CREATE INDEX "Document_institutionId_folderId_idx" ON "Document"("institutionId", "folderId");

-- CreateIndex
CREATE INDEX "Document_institutionId_category_idx" ON "Document"("institutionId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE INDEX "Student_institutionId_enrollmentStatus_idx" ON "Student"("institutionId", "enrollmentStatus");

-- CreateIndex
CREATE INDEX "Student_createdById_idx" ON "Student"("createdById");

-- CreateIndex
CREATE INDEX "Student_validatedById_idx" ON "Student"("validatedById");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPermission" ADD CONSTRAINT "DocumentPermission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPermission" ADD CONSTRAINT "DocumentPermission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPermission" ADD CONSTRAINT "DocumentPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPermission" ADD CONSTRAINT "DocumentPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRequest" ADD CONSTRAINT "BudgetRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRequest" ADD CONSTRAINT "BudgetRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRequest" ADD CONSTRAINT "BudgetRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRequest" ADD CONSTRAINT "BudgetRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRequest" ADD CONSTRAINT "BudgetRequest_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPlanOrder" ADD CONSTRAINT "PublicPlanOrder_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPlanOrder" ADD CONSTRAINT "PublicPlanOrder_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
