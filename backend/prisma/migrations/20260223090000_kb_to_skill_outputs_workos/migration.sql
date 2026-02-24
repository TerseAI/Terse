-- Follow-up migration for WorkOS KB -> skill outputs.
-- Kept separate from already-applied migrations to ensure forward upgrades from main.

-- CreateTable
CREATE TABLE IF NOT EXISTS "automation_workos_output_configs" (
    "id" TEXT NOT NULL,
    "automation_output_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_workos_output_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "automation_workos_output_configs_automation_output_id_key" ON "automation_workos_output_configs"("automation_output_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'automation_workos_output_configs_automation_output_id_fkey'
    ) THEN
        ALTER TABLE "automation_workos_output_configs"
            ADD CONSTRAINT "automation_workos_output_configs_automation_output_id_fkey"
            FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Data migration: WorkOS KB rows -> outputs/configs
DROP TABLE IF EXISTS tmp_kb_workos_candidates;
CREATE TEMP TABLE tmp_kb_workos_candidates AS
SELECT
    akb."id" AS kb_id,
    akb."automation_id",
    akb."integration_id",
    COALESCE(
        (
            SELECT ao."id"
            FROM "automation_outputs" ao
            WHERE ao."automation_id" = akb."automation_id"
              AND ao."integration_id" = akb."integration_id"
              AND ao."config_type" = 'WORKOS'::"OutputConfigType"
            ORDER BY ao."created_at" ASC
            LIMIT 1
        ),
        ('mig_wo_' || akb."id")
    ) AS output_id,
    ('mig_wo_cfg_' || akb."id") AS output_config_id
FROM "automation_knowledge_bases" akb
INNER JOIN "automation_workos_kb_configs" awk
    ON awk."automation_knowledge_base_id" = akb."id";

INSERT INTO "automation_outputs" ("id", "automation_id",  "config_type", "integration_id", "created_at", "updated_at")
SELECT
    wkc."output_id",
    wkc."automation_id",
    'WORKOS'::"OutputConfigType",
    wkc."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_workos_candidates wkc
WHERE NOT EXISTS (
    SELECT 1
    FROM "automation_outputs" ao
    WHERE ao."id" = wkc."output_id"
);

INSERT INTO "automation_workos_output_configs" ("id", "automation_output_id", "created_at", "updated_at")
SELECT
    wkc."output_config_id",
    wkc."output_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_workos_candidates wkc
WHERE EXISTS (
    SELECT 1
    FROM "automation_outputs" ao
    WHERE ao."id" = wkc."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;

DROP TABLE IF EXISTS tmp_kb_workos_candidates;
