-- AlterTable
ALTER TABLE "project_deploys" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "failure_reason" VARCHAR(500),
ADD COLUMN     "jobs_added" INTEGER,
ADD COLUMN     "jobs_removed" INTEGER;

-- CreateTable
CREATE TABLE "project_deploy_jobs" (
    "deploy_id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,

    CONSTRAINT "project_deploy_jobs_pkey" PRIMARY KEY ("deploy_id","job_name")
);

-- CreateIndex
CREATE INDEX "project_deploy_jobs_deploy_id_idx" ON "project_deploy_jobs"("deploy_id");

-- AddForeignKey
ALTER TABLE "project_deploy_jobs" ADD CONSTRAINT "project_deploy_jobs_deploy_id_fkey" FOREIGN KEY ("deploy_id") REFERENCES "project_deploys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
