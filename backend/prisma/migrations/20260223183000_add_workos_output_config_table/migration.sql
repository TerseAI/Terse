-- CreateTable
CREATE TABLE "automation_workos_output_configs" (
    "id" TEXT NOT NULL,
    "automation_output_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_workos_output_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "automation_workos_output_configs_automation_output_id_key" ON "automation_workos_output_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "automation_workos_output_configs" ADD CONSTRAINT "automation_workos_output_configs_automation_output_id_fkey"
    FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
