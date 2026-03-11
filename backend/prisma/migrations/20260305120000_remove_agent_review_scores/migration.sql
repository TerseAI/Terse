-- AlterTable
ALTER TABLE "agent_reviews" DROP COLUMN "score_task_quality",
DROP COLUMN "score_consistency",
DROP COLUMN "score_efficiency",
DROP COLUMN "overall_score",
ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
