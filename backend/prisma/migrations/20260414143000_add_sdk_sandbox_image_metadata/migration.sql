ALTER TABLE "automation_prompts"
ADD COLUMN "sandbox_image_id" TEXT,
ADD COLUMN "sandbox_image_hash" TEXT,
ADD COLUMN "sandbox_runtime" TEXT;
