-- DropForeignKey
ALTER TABLE "automations" DROP CONSTRAINT "automations_project_id_fkey";

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
