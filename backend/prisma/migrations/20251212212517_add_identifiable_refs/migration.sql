-- CreateTable
CREATE TABLE "identifiable_refs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identifiable_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identifiable_refs_entity_type_idx" ON "identifiable_refs"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "identifiable_refs_entity_type_entity_id_key" ON "identifiable_refs"("entity_type", "entity_id");
