-- CreateEnum
CREATE TYPE "AgentImprovementStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- AlterTable
ALTER TABLE "automations"
ADD COLUMN "improvements_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "agent_reviews" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "score_task_quality" INTEGER NOT NULL,
    "score_consistency" INTEGER NOT NULL,
    "score_efficiency" INTEGER NOT NULL,
    "overall_score" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "runs_analyzed" INTEGER NOT NULL,
    "review_period_start" TIMESTAMP(3) NOT NULL,
    "review_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_improvements" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_area" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "AgentImprovementStatus" NOT NULL DEFAULT 'PENDING',
    "applied_prompt" TEXT,
    "applied_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_improvements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_reviews_automation_id_idx" ON "agent_reviews"("automation_id");

-- CreateIndex
CREATE INDEX "agent_reviews_organization_id_idx" ON "agent_reviews"("organization_id");

-- CreateIndex
CREATE INDEX "agent_reviews_created_at_idx" ON "agent_reviews"("created_at");

-- CreateIndex
CREATE INDEX "agent_improvements_automation_id_idx" ON "agent_improvements"("automation_id");

-- CreateIndex
CREATE INDEX "agent_improvements_review_id_idx" ON "agent_improvements"("review_id");

-- CreateIndex
CREATE INDEX "agent_improvements_status_idx" ON "agent_improvements"("status");

-- CreateIndex
CREATE INDEX "agent_improvements_automation_id_title_idx" ON "agent_improvements"("automation_id", "title");

-- AddForeignKey
ALTER TABLE "agent_reviews"
ADD CONSTRAINT "agent_reviews_automation_id_fkey"
FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_improvements"
ADD CONSTRAINT "agent_improvements_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "agent_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_improvements"
ADD CONSTRAINT "agent_improvements_automation_id_fkey"
FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
