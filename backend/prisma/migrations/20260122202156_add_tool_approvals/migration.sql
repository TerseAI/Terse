-- CreateTable
CREATE TABLE "automation_tool_approvals" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_tool_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_tool_approvals_automation_id_idx" ON "automation_tool_approvals"("automation_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_tool_approvals_automation_id_tool_name_key" ON "automation_tool_approvals"("automation_id", "tool_name");

-- AddForeignKey
ALTER TABLE "automation_tool_approvals" ADD CONSTRAINT "automation_tool_approvals_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
