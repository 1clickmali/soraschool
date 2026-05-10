-- Additive migration: user theme preferences and request idempotency.

CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

ALTER TABLE "User"
  ADD COLUMN "themePreference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';

CREATE TABLE "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "userId" TEXT,
  "institutionId" TEXT,
  "action" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "state" TEXT NOT NULL DEFAULT 'PROCESSING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_key_userId_action_key"
  ON "IdempotencyKey"("key", "userId", "action");

CREATE INDEX "IdempotencyKey_institutionId_action_idx"
  ON "IdempotencyKey"("institutionId", "action");

CREATE INDEX "IdempotencyKey_expiresAt_idx"
  ON "IdempotencyKey"("expiresAt");

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
