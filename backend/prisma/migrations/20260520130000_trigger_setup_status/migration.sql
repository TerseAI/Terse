-- Trigger setup-status surface: tracks whether the upstream
-- webhook/subscription registration for an automation_input has run
-- successfully. Defaulting existing rows to ACTIVE because today the
-- post-commit setupAgentTriggers errors are silently swallowed — every
-- live trigger row has effectively been treated as ACTIVE regardless of
-- whether the external setup actually succeeded. New rows start PENDING
-- and the route flow flips them to ACTIVE or FAILED.

-- CreateEnum
CREATE TYPE "TriggerSetupStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "automation_inputs"
    ADD COLUMN "setup_status" "TriggerSetupStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "setup_error" TEXT;
