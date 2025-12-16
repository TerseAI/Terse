-- CreateTable
CREATE TABLE "output_change_attributions" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "source_item_ref_id" TEXT NOT NULL,
    "output_item_id" TEXT NOT NULL,
    "output_item_type" "OutputConfigType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "output_change_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "output_change_attributions_source_item_ref_id_output_item_i_idx" ON "output_change_attributions"("source_item_ref_id", "output_item_id");

-- AddForeignKey
ALTER TABLE "output_change_attributions" ADD CONSTRAINT "output_change_attributions_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_change_attributions" ADD CONSTRAINT "output_change_attributions_source_item_ref_id_fkey" FOREIGN KEY ("source_item_ref_id") REFERENCES "identifiable_refs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
