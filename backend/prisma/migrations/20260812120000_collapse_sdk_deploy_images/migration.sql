-- Deploys now build a single image instead of a dependency layer plus a source layer.
-- Existing rows keep their sandbox image so live deploys and in-flight runs are unaffected;
-- they get a legacy build_hash that no new build can ever match, so the next deploy rebuilds once.

ALTER TABLE "sdk_source_images" ADD COLUMN "build_hash" TEXT;
ALTER TABLE "sdk_source_images" ADD COLUMN "cli_version" TEXT;
ALTER TABLE "sdk_source_images" ADD COLUMN "base_image_tag" TEXT;

UPDATE "sdk_source_images" AS s
SET "build_hash" = 'legacy-' || s."id",
    "cli_version" = COALESCE(d."cli_version", 'unknown'),
    "base_image_tag" = COALESCE(d."base_image_tag", 'unknown')
FROM "sdk_dependency_images" AS d
WHERE d."id" = s."dependency_image_id";

UPDATE "sdk_source_images"
SET "build_hash" = 'legacy-' || "id",
    "cli_version" = COALESCE("cli_version", 'unknown'),
    "base_image_tag" = COALESCE("base_image_tag", 'unknown')
WHERE "build_hash" IS NULL;

ALTER TABLE "sdk_source_images" ALTER COLUMN "build_hash" SET NOT NULL;
ALTER TABLE "sdk_source_images" ALTER COLUMN "cli_version" SET NOT NULL;
ALTER TABLE "sdk_source_images" ALTER COLUMN "base_image_tag" SET NOT NULL;

ALTER TABLE "sdk_source_images" DROP CONSTRAINT "sdk_source_images_dependency_image_id_fkey";
DROP INDEX IF EXISTS "sdk_source_images_organization_id_dependency_image_id_sourc_key";
ALTER TABLE "sdk_source_images" DROP COLUMN "dependency_image_id";

CREATE UNIQUE INDEX "sdk_source_images_organization_id_build_hash_key" ON "sdk_source_images"("organization_id", "build_hash");
