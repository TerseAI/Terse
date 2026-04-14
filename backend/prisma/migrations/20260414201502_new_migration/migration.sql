-- DropIndex
DROP INDEX "automation_prompts_current_sdk_source_image_id_idx";

-- RenameIndex
ALTER INDEX "sdk_source_images_organization_id_dependency_image_id_source_ha" RENAME TO "sdk_source_images_organization_id_dependency_image_id_sourc_key";
