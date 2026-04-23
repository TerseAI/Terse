-- AlterTable
ALTER TABLE "sdk_dependency_images" ADD COLUMN "cli_version" TEXT;

UPDATE "sdk_dependency_images"
SET "cli_version" = '0.1.33'
WHERE "cli_version" IS NULL;

ALTER TABLE "sdk_dependency_images"
ALTER COLUMN "cli_version" SET NOT NULL;
