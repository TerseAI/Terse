/*
  Warnings:

  - You are about to drop the column `job_url` on the `automation_prompts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "automation_prompts" DROP COLUMN "job_url",
ADD COLUMN     "remote_server_url" TEXT;
