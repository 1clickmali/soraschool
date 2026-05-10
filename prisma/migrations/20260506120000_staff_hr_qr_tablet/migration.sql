-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('TEACHER', 'SECRETARIAT', 'ACCOUNTANT', 'SUPERVISOR', 'ASSISTANT_DIRECTOR', 'CENSOR', 'EDUCATION_ADVISOR', 'LIBRARIAN', 'CASHIER', 'ADMIN_AGENT', 'GUARD', 'DRIVER', 'CANTEEN', 'CLEANING', 'STOCK_MANAGER', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EARLY_DEPARTURE', 'NOT_CHECKED_IN');

-- CreateEnum
CREATE TYPE "StaffAttendanceMethod" AS ENUM ('QR_CODE', 'TABLET_QR', 'MANUAL_DIRECTOR', 'EXCEPTION_CORRECTION', 'SYSTEM_DETECTION');

-- CreateEnum
CREATE TYPE "StaffJustificationStatus" AS ENUM ('NONE', 'PENDING', 'ACCEPTED', 'REFUSED', 'NEEDS_MORE_INFO');

-- CreateEnum
CREATE TYPE "StaffPenaltyStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELED', 'WAIVED');

-- CreateEnum
CREATE TYPE "StaffContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SIGNED', 'ARCHIVED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "StaffSalaryAdjustmentKind" AS ENUM ('BONUS', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "StaffTabletLinkStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "actorKey" TEXT NOT NULL DEFAULT 'anonymous';

-- CreateTable
CREATE TABLE "StaffRoleTemplate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "establishmentId" TEXT,
    "userId" TEXT,
    "teacherId" TEXT,
    "roleTemplateId" TEXT,
    "matricule" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "photoUrl" TEXT,
    "position" "StaffPosition" NOT NULL,
    "customPosition" TEXT,
    "systemRole" "UserRole",
    "contractType" "ContractType" NOT NULL DEFAULT 'CDI',
    "baseSalary" INTEGER NOT NULL DEFAULT 0,
    "hireDate" TIMESTAMP(3),
    "permissions" JSONB,
    "qrTokenVersion" INTEGER NOT NULL DEFAULT 1,
    "qrActive" BOOLEAN NOT NULL DEFAULT true,
    "qrGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceSetting" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "defaultCheckInTime" TEXT NOT NULL DEFAULT '08:00',
    "defaultCheckOutTime" TEXT NOT NULL DEFAULT '17:00',
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 10,
    "earlyDepartureToleranceMinutes" INTEGER NOT NULL DEFAULT 10,
    "latePenaltyAmount" INTEGER NOT NULL DEFAULT 1000,
    "absencePenaltyAmount" INTEGER NOT NULL DEFAULT 2500,
    "justificationDeadlineHours" INTEGER NOT NULL DEFAULT 48,
    "autoApplyPenalties" BOOLEAN NOT NULL DEFAULT false,
    "policy" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceKey" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "scheduleSlotId" TEXT,
    "expectedCheckInAt" TIMESTAMP(3),
    "actualCheckInAt" TIMESTAMP(3),
    "expectedCheckOutAt" TIMESTAMP(3),
    "actualCheckOutAt" TIMESTAMP(3),
    "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'NOT_CHECKED_IN',
    "method" "StaffAttendanceMethod" NOT NULL DEFAULT 'QR_CODE',
    "justificationStatus" "StaffJustificationStatus" NOT NULL DEFAULT 'NONE',
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyDepartureMinutes" INTEGER NOT NULL DEFAULT 0,
    "penaltyAmount" INTEGER NOT NULL DEFAULT 0,
    "penaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "sourceTabletLinkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffJustification" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "supplementNumber" INTEGER NOT NULL DEFAULT 0,
    "status" "StaffJustificationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "directorComment" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffJustification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPenalty" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "StaffPenaltyStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSalaryAdjustment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" "StaffSalaryAdjustmentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSalaryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffContract" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "activeKey" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Contrat du personnel',
    "status" "StaffContractStatus" NOT NULL DEFAULT 'DRAFT',
    "salary" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "scheduleText" TEXT,
    "generalClauses" TEXT NOT NULL,
    "specificClauses" TEXT,
    "penaltyClauses" TEXT,
    "obligations" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTabletLink" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "status" "StaffTabletLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "deviceHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTabletLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTabletScanLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "tabletLinkId" TEXT,
    "staffId" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "message" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTabletScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffRoleTemplate_institutionId_idx" ON "StaffRoleTemplate"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRoleTemplate_institutionId_name_key" ON "StaffRoleTemplate"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_teacherId_key" ON "StaffMember"("teacherId");

-- CreateIndex
CREATE INDEX "StaffMember_institutionId_position_idx" ON "StaffMember"("institutionId", "position");

-- CreateIndex
CREATE INDEX "StaffMember_institutionId_status_idx" ON "StaffMember"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StaffMember_institutionId_teacherId_idx" ON "StaffMember"("institutionId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_institutionId_matricule_key" ON "StaffMember"("institutionId", "matricule");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceSetting_institutionId_key" ON "StaffAttendanceSetting"("institutionId");

-- CreateIndex
CREATE INDEX "StaffAttendance_institutionId_staffId_date_idx" ON "StaffAttendance"("institutionId", "staffId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_institutionId_status_date_idx" ON "StaffAttendance"("institutionId", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_institutionId_attendanceKey_key" ON "StaffAttendance"("institutionId", "attendanceKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffJustification_attendanceId_key" ON "StaffJustification"("attendanceId");

-- CreateIndex
CREATE INDEX "StaffJustification_institutionId_status_idx" ON "StaffJustification"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StaffJustification_institutionId_staffId_idx" ON "StaffJustification"("institutionId", "staffId");

-- CreateIndex
CREATE INDEX "StaffPenalty_institutionId_staffId_status_idx" ON "StaffPenalty"("institutionId", "staffId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPenalty_institutionId_eventType_eventId_key" ON "StaffPenalty"("institutionId", "eventType", "eventId");

-- CreateIndex
CREATE INDEX "StaffSalaryAdjustment_institutionId_staffId_year_month_idx" ON "StaffSalaryAdjustment"("institutionId", "staffId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StaffContract_activeKey_key" ON "StaffContract"("activeKey");

-- CreateIndex
CREATE INDEX "StaffContract_institutionId_staffId_status_idx" ON "StaffContract"("institutionId", "staffId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffContract_institutionId_number_key" ON "StaffContract"("institutionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTabletLink_tokenHash_key" ON "StaffTabletLink"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffTabletLink_institutionId_status_idx" ON "StaffTabletLink"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StaffTabletLink_expiresAt_idx" ON "StaffTabletLink"("expiresAt");

-- CreateIndex
CREATE INDEX "StaffTabletScanLog_institutionId_createdAt_idx" ON "StaffTabletScanLog"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffTabletScanLog_tabletLinkId_idx" ON "StaffTabletScanLog"("tabletLinkId");

-- CreateIndex
CREATE INDEX "StaffTabletScanLog_staffId_idx" ON "StaffTabletScanLog"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_actorKey_action_key" ON "IdempotencyKey"("key", "actorKey", "action");

-- AddForeignKey
ALTER TABLE "StaffRoleTemplate" ADD CONSTRAINT "StaffRoleTemplate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_roleTemplateId_fkey" FOREIGN KEY ("roleTemplateId") REFERENCES "StaffRoleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSetting" ADD CONSTRAINT "StaffAttendanceSetting_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_sourceTabletLinkId_fkey" FOREIGN KEY ("sourceTabletLinkId") REFERENCES "StaffTabletLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJustification" ADD CONSTRAINT "StaffJustification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJustification" ADD CONSTRAINT "StaffJustification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJustification" ADD CONSTRAINT "StaffJustification_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "StaffAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPenalty" ADD CONSTRAINT "StaffPenalty_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPenalty" ADD CONSTRAINT "StaffPenalty_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPenalty" ADD CONSTRAINT "StaffPenalty_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "StaffAttendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryAdjustment" ADD CONSTRAINT "StaffSalaryAdjustment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryAdjustment" ADD CONSTRAINT "StaffSalaryAdjustment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContract" ADD CONSTRAINT "StaffContract_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContract" ADD CONSTRAINT "StaffContract_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTabletLink" ADD CONSTRAINT "StaffTabletLink_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTabletScanLog" ADD CONSTRAINT "StaffTabletScanLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTabletScanLog" ADD CONSTRAINT "StaffTabletScanLog_tabletLinkId_fkey" FOREIGN KEY ("tabletLinkId") REFERENCES "StaffTabletLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTabletScanLog" ADD CONSTRAINT "StaffTabletScanLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
