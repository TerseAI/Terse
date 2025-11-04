-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'FIGMA';

-- CreateTable
CREATE TABLE "processed_figma_comments" (
    "id" TEXT NOT NULL,
    "figma_integration_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_figma_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "figma_webhooks" (
    "id" TEXT NOT NULL,
    "figma_integration_id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "team_id" TEXT,
    "endpoint_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "figma_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "figma_comment_context" (
    "id" TEXT NOT NULL,
    "figma_integration_id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "node_id" TEXT,
    "comment_data" JSONB NOT NULL,
    "node_context" JSONB,
    "file_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "figma_comment_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_figma_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT,
    "automation_output_id" TEXT,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_figma_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_figma_comments_figma_integration_id_idx" ON "processed_figma_comments"("figma_integration_id");

-- CreateIndex
CREATE INDEX "processed_figma_comments_file_key_idx" ON "processed_figma_comments"("file_key");

-- CreateIndex
CREATE INDEX "processed_figma_comments_processed_at_idx" ON "processed_figma_comments"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_figma_comments_figma_integration_id_comment_id_key" ON "processed_figma_comments"("figma_integration_id", "comment_id");

-- CreateIndex
CREATE INDEX "figma_webhooks_figma_integration_id_idx" ON "figma_webhooks"("figma_integration_id");

-- CreateIndex
CREATE INDEX "figma_webhooks_file_key_idx" ON "figma_webhooks"("file_key");

-- CreateIndex
CREATE INDEX "figma_webhooks_webhook_id_idx" ON "figma_webhooks"("webhook_id");

-- CreateIndex
CREATE UNIQUE INDEX "figma_webhooks_automation_input_id_key" ON "figma_webhooks"("automation_input_id");

-- CreateIndex
CREATE INDEX "figma_comment_context_figma_integration_id_idx" ON "figma_comment_context"("figma_integration_id");

-- CreateIndex
CREATE INDEX "figma_comment_context_file_key_idx" ON "figma_comment_context"("file_key");

-- CreateIndex
CREATE INDEX "figma_comment_context_node_id_idx" ON "figma_comment_context"("node_id");

-- CreateIndex
CREATE INDEX "figma_comment_context_created_at_idx" ON "figma_comment_context"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "figma_comment_context_figma_integration_id_comment_id_key" ON "figma_comment_context"("figma_integration_id", "comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_figma_configs_automation_input_id_key" ON "automation_figma_configs"("automation_input_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_figma_configs_automation_output_id_key" ON "automation_figma_configs"("automation_output_id");

-- CreateIndex
CREATE INDEX "automation_figma_configs_file_key_idx" ON "automation_figma_configs"("file_key");

-- AddForeignKey
ALTER TABLE "processed_figma_comments" ADD CONSTRAINT "processed_figma_comments_figma_integration_id_fkey" FOREIGN KEY ("figma_integration_id") REFERENCES "figma_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figma_webhooks" ADD CONSTRAINT "figma_webhooks_figma_integration_id_fkey" FOREIGN KEY ("figma_integration_id") REFERENCES "figma_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figma_comment_context" ADD CONSTRAINT "figma_comment_context_figma_integration_id_fkey" FOREIGN KEY ("figma_integration_id") REFERENCES "figma_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_figma_configs" ADD CONSTRAINT "automation_figma_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_figma_configs" ADD CONSTRAINT "automation_figma_configs_automation_output_id_fkey" FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
