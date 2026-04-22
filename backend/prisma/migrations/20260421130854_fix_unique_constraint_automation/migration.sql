-- DropIndex
DROP INDEX "automations_name_organization_id_source_idx";

-- CreateIndex
CREATE INDEX "automations_name_organization_id_source_project_id_idx" ON "automations"("name", "organization_id", "source", "project_id");
