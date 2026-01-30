/*
  Warnings:

  - You are about to drop the `jira_api_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `linear_api_keys` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "jira_api_keys" DROP CONSTRAINT "jira_api_keys_user_id_fkey";

-- DropForeignKey
ALTER TABLE "linear_api_keys" DROP CONSTRAINT "linear_api_keys_user_id_fkey";

-- DropTable
DROP TABLE "jira_api_keys";

-- DropTable
DROP TABLE "linear_api_keys";
