-- AlterTable
ALTER TABLE "automation_prompts" ADD COLUMN     "current_sdk_source_image_id" TEXT;

-- AlterTable
ALTER TABLE "run_history_records" ADD COLUMN     "sdk_source_image_id" TEXT;

-- CreateTable
CREATE TABLE "sdk_dependency_images" (
    "id" TEXT NOT NULL,
    "dependency_hash" TEXT NOT NULL,
    "runtime" TEXT NOT NULL,
    "base_image_tag" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sdk_dependency_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdk_source_images" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "runtime" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "gcs_key" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "dependency_image_id" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sdk_source_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sdk_dependency_images_dependency_hash_key" ON "sdk_dependency_images"("dependency_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_dependency_images_image_id_key" ON "sdk_dependency_images"("image_id");

-- CreateIndex
CREATE INDEX "sdk_dependency_images_runtime_idx" ON "sdk_dependency_images"("runtime");

-- CreateIndex
CREATE INDEX "sdk_dependency_images_last_used_at_idx" ON "sdk_dependency_images"("last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_source_images_image_id_key" ON "sdk_source_images"("image_id");

-- CreateIndex
CREATE INDEX "sdk_source_images_organization_id_idx" ON "sdk_source_images"("organization_id");

-- CreateIndex
CREATE INDEX "sdk_source_images_gcs_key_idx" ON "sdk_source_images"("gcs_key");

-- CreateIndex
CREATE INDEX "sdk_source_images_last_used_at_idx" ON "sdk_source_images"("last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_source_images_organization_id_dependency_image_id_sourc_key" ON "sdk_source_images"("organization_id", "dependency_image_id", "source_hash");

-- CreateIndex
CREATE INDEX "run_history_records_sdk_source_image_id_idx" ON "run_history_records"("sdk_source_image_id");

-- AddForeignKey
ALTER TABLE "automation_prompts" ADD CONSTRAINT "automation_prompts_current_sdk_source_image_id_fkey" FOREIGN KEY ("current_sdk_source_image_id") REFERENCES "sdk_source_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdk_source_images" ADD CONSTRAINT "sdk_source_images_dependency_image_id_fkey" FOREIGN KEY ("dependency_image_id") REFERENCES "sdk_dependency_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_history_records" ADD CONSTRAINT "run_history_records_sdk_source_image_id_fkey" FOREIGN KEY ("sdk_source_image_id") REFERENCES "sdk_source_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
