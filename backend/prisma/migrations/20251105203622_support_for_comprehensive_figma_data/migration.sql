-- AlterTable
ALTER TABLE "figma_comment_context" ADD COLUMN     "image_expiry" TIMESTAMP(3),
ADD COLUMN     "image_urls" JSONB,
ADD COLUMN     "matched_node_ids" TEXT[],
ADD COLUMN     "positioning_data" JSONB;
