/*
  Warnings:

  - You are about to drop the column `space_key` on the `automation_confluence_configs` table. All the data in the column will be lost.
  - You are about to drop the `atlassian_integrations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."atlassian_integrations" DROP CONSTRAINT "atlassian_integrations_user_id_fkey";

-- DropIndex
DROP INDEX "public"."automation_confluence_configs_space_key_idx";

-- AlterTable
ALTER TABLE "automation_confluence_configs" DROP COLUMN "space_key",
ADD COLUMN     "space_name" TEXT;

-- DropTable
DROP TABLE "public"."atlassian_integrations";

-- CreateIndex
CREATE INDEX "automation_confluence_configs_space_name_idx" ON "automation_confluence_configs"("space_name");
