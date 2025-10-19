-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GITHUB', 'GMAIL', 'LINEAR', 'JIRA', 'SLACK', 'NOTION');

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_prompts" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_inputs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "integration_type" "IntegrationType" NOT NULL,
    "integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_outputs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "integration_type" "IntegrationType" NOT NULL,
    "integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automations_user_id_idx" ON "automations"("user_id");

-- CreateIndex
CREATE INDEX "automations_is_active_idx" ON "automations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "automation_prompts_automation_id_key" ON "automation_prompts"("automation_id");

-- CreateIndex
CREATE INDEX "automation_inputs_automation_id_idx" ON "automation_inputs"("automation_id");

-- CreateIndex
CREATE INDEX "automation_inputs_integration_type_integration_id_idx" ON "automation_inputs"("integration_type", "integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_outputs_automation_id_key" ON "automation_outputs"("automation_id");

-- CreateIndex
CREATE INDEX "automation_outputs_integration_type_integration_id_idx" ON "automation_outputs"("integration_type", "integration_id");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_prompts" ADD CONSTRAINT "automation_prompts_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_inputs" ADD CONSTRAINT "automation_inputs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_outputs" ADD CONSTRAINT "automation_outputs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
