-- CreateTable
CREATE TABLE "automation_tool_approval_settings" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_tool_approval_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_tool_approval_settings_automation_id_idx" ON "automation_tool_approval_settings"("automation_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_tool_approval_settings_automation_id_tool_name_key" ON "automation_tool_approval_settings"("automation_id", "tool_name");

-- AddForeignKey
ALTER TABLE "automation_tool_approval_settings" ADD CONSTRAINT "automation_tool_approval_settings_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
