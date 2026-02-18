-- AlterTable
ALTER TABLE "automation_posthog_configs" ADD COLUMN "automation_output_id" TEXT;
ALTER TABLE "automation_posthog_configs" ALTER COLUMN "automation_knowledge_base_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "automation_datadog_configs" ADD COLUMN "automation_output_id" TEXT;
ALTER TABLE "automation_datadog_configs" ALTER COLUMN "automation_knowledge_base_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "automation_launchdarkly_configs" ADD COLUMN "automation_output_id" TEXT;
ALTER TABLE "automation_launchdarkly_configs" ALTER COLUMN "automation_knowledge_base_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "automation_posthog_configs_automation_output_id_key" ON "automation_posthog_configs"("automation_output_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_datadog_configs_automation_output_id_key" ON "automation_datadog_configs"("automation_output_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_launchdarkly_configs_automation_output_id_key" ON "automation_launchdarkly_configs"("automation_output_id");

-- AddForeignKey
ALTER TABLE "automation_posthog_configs" ADD CONSTRAINT "automation_posthog_configs_automation_output_id_fkey"
    FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_datadog_configs" ADD CONSTRAINT "automation_datadog_configs_automation_output_id_fkey"
    FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_launchdarkly_configs" ADD CONSTRAINT "automation_launchdarkly_configs_automation_output_id_fkey"
    FOREIGN KEY ("automation_output_id") REFERENCES "automation_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: convert existing GitHub carrier rows from TERSE -> GITHUB
UPDATE "automation_outputs"
SET "config_type" = 'GITHUB'::"OutputConfigType"
WHERE "config_type" = 'TERSE'::"OutputConfigType"
  AND "id" IN (
      SELECT "automation_output_id"
      FROM "automation_github_configs"
      WHERE "automation_output_id" IS NOT NULL
  );

-- Data migration: create GitHub outputs from legacy KB rows (if equivalent output config does not already exist)
WITH github_kb AS (
    SELECT
        akb."id" AS kb_id,
        agk."id" AS kb_config_id,
        akb."automation_id",
        akb."integration_id",
        agk."repository_ids",
        ('mig_gh_' || substr(md5(akb."id"), 1, 24)) AS output_id,
        ('mig_gh_cfg_' || substr(md5(agk."id"), 1, 24)) AS output_config_id
    FROM "automation_knowledge_bases" akb
    INNER JOIN "automation_github_kb_configs" agk
        ON agk."automation_knowledge_base_id" = akb."id"
    WHERE akb."config_type" = 'GITHUB'
),
github_to_migrate AS (
    SELECT *
    FROM github_kb gk
    WHERE NOT EXISTS (
        SELECT 1
        FROM "automation_outputs" ao
        INNER JOIN "automation_github_configs" agc
            ON agc."automation_output_id" = ao."id"
        WHERE ao."automation_id" = gk."automation_id"
          AND ao."integration_id" = gk."integration_id"
          AND ao."config_type" = 'GITHUB'::"OutputConfigType"
          AND agc."repository_ids" = gk."repository_ids"
    )
)
INSERT INTO "automation_outputs" ("id", "automation_id", "read_only", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    gtm."output_id",
    gtm."automation_id",
    true,
    'GITHUB'::"OutputConfigType",
    gtm."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM github_to_migrate gtm
ON CONFLICT ("id") DO NOTHING;

WITH github_kb AS (
    SELECT
        akb."id" AS kb_id,
        agk."id" AS kb_config_id,
        agk."repository_ids",
        ('mig_gh_' || substr(md5(akb."id"), 1, 24)) AS output_id,
        ('mig_gh_cfg_' || substr(md5(agk."id"), 1, 24)) AS output_config_id
    FROM "automation_knowledge_bases" akb
    INNER JOIN "automation_github_kb_configs" agk
        ON agk."automation_knowledge_base_id" = akb."id"
    WHERE akb."config_type" = 'GITHUB'
)
INSERT INTO "automation_github_configs" ("id", "automation_output_id", "repository_ids", "created_at", "updated_at")
SELECT
    gk."output_config_id",
    gk."output_id",
    gk."repository_ids",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM github_kb gk
WHERE EXISTS (
    SELECT 1 FROM "automation_outputs" ao WHERE ao."id" = gk."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;

-- Data migration: create PostHog outputs and link legacy config rows
WITH posthog_kb AS (
    SELECT
        apc."automation_knowledge_base_id" AS kb_id,
        akb."automation_id",
        akb."integration_id",
        ('mig_ph_' || substr(md5(apc."automation_knowledge_base_id"), 1, 24)) AS output_id
    FROM "automation_posthog_configs" apc
    INNER JOIN "automation_knowledge_bases" akb
        ON akb."id" = apc."automation_knowledge_base_id"
    WHERE apc."automation_knowledge_base_id" IS NOT NULL
)
INSERT INTO "automation_outputs" ("id", "automation_id", "read_only", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    pk."output_id",
    pk."automation_id",
    true,
    'POSTHOG'::"OutputConfigType",
    pk."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM posthog_kb pk
ON CONFLICT ("id") DO NOTHING;

UPDATE "automation_posthog_configs" apc
SET "automation_output_id" = ('mig_ph_' || substr(md5(apc."automation_knowledge_base_id"), 1, 24))
WHERE apc."automation_knowledge_base_id" IS NOT NULL
  AND apc."automation_output_id" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "automation_outputs" ao
      WHERE ao."id" = ('mig_ph_' || substr(md5(apc."automation_knowledge_base_id"), 1, 24))
  );

-- Data migration: create Datadog outputs and link legacy config rows
WITH datadog_kb AS (
    SELECT
        adc."automation_knowledge_base_id" AS kb_id,
        akb."automation_id",
        akb."integration_id",
        ('mig_dd_' || substr(md5(adc."automation_knowledge_base_id"), 1, 24)) AS output_id
    FROM "automation_datadog_configs" adc
    INNER JOIN "automation_knowledge_bases" akb
        ON akb."id" = adc."automation_knowledge_base_id"
    WHERE adc."automation_knowledge_base_id" IS NOT NULL
)
INSERT INTO "automation_outputs" ("id", "automation_id", "read_only", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    dk."output_id",
    dk."automation_id",
    true,
    'DATADOG'::"OutputConfigType",
    dk."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM datadog_kb dk
ON CONFLICT ("id") DO NOTHING;

UPDATE "automation_datadog_configs" adc
SET "automation_output_id" = ('mig_dd_' || substr(md5(adc."automation_knowledge_base_id"), 1, 24))
WHERE adc."automation_knowledge_base_id" IS NOT NULL
  AND adc."automation_output_id" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "automation_outputs" ao
      WHERE ao."id" = ('mig_dd_' || substr(md5(adc."automation_knowledge_base_id"), 1, 24))
  );

-- Data migration: create LaunchDarkly outputs and link legacy config rows
WITH launchdarkly_kb AS (
    SELECT
        alc."automation_knowledge_base_id" AS kb_id,
        akb."automation_id",
        akb."integration_id",
        ('mig_ld_' || substr(md5(alc."automation_knowledge_base_id"), 1, 24)) AS output_id
    FROM "automation_launchdarkly_configs" alc
    INNER JOIN "automation_knowledge_bases" akb
        ON akb."id" = alc."automation_knowledge_base_id"
    WHERE alc."automation_knowledge_base_id" IS NOT NULL
)
INSERT INTO "automation_outputs" ("id", "automation_id", "read_only", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    lk."output_id",
    lk."automation_id",
    true,
    'LAUNCHDARKLY'::"OutputConfigType",
    lk."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM launchdarkly_kb lk
ON CONFLICT ("id") DO NOTHING;

UPDATE "automation_launchdarkly_configs" alc
SET "automation_output_id" = ('mig_ld_' || substr(md5(alc."automation_knowledge_base_id"), 1, 24))
WHERE alc."automation_knowledge_base_id" IS NOT NULL
  AND alc."automation_output_id" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "automation_outputs" ao
      WHERE ao."id" = ('mig_ld_' || substr(md5(alc."automation_knowledge_base_id"), 1, 24))
  );

-- Data migration: create Linear outputs/configs from legacy KB rows
WITH linear_kb AS (
    SELECT
        akb."id" AS kb_id,
        alk."id" AS kb_config_id,
        akb."automation_id",
        akb."integration_id",
        alk."team_id",
        alk."team_name",
        alk."project_id",
        alk."project_name",
        ('mig_ln_' || substr(md5(akb."id"), 1, 24)) AS output_id,
        ('mig_ln_cfg_' || substr(md5(alk."id"), 1, 24)) AS output_config_id
    FROM "automation_knowledge_bases" akb
    INNER JOIN "automation_linear_kb_configs" alk
        ON alk."automation_knowledge_base_id" = akb."id"
    WHERE akb."config_type" = 'LINEAR'
),
linear_to_migrate AS (
    SELECT *
    FROM linear_kb lk
    WHERE NOT EXISTS (
        SELECT 1
        FROM "automation_outputs" ao
        INNER JOIN "automation_linear_configs" alc
            ON alc."automation_output_id" = ao."id"
        WHERE ao."automation_id" = lk."automation_id"
          AND ao."integration_id" = lk."integration_id"
          AND ao."config_type" = 'LINEAR_TICKET'::"OutputConfigType"
          AND alc."team_id" IS NOT DISTINCT FROM lk."team_id"
          AND alc."project_id" IS NOT DISTINCT FROM lk."project_id"
    )
)
INSERT INTO "automation_outputs" ("id", "automation_id", "read_only", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    ltm."output_id",
    ltm."automation_id",
    true,
    'LINEAR_TICKET'::"OutputConfigType",
    ltm."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM linear_to_migrate ltm
ON CONFLICT ("id") DO NOTHING;

WITH linear_kb AS (
    SELECT
        akb."id" AS kb_id,
        alk."id" AS kb_config_id,
        alk."team_id",
        alk."team_name",
        alk."project_id",
        alk."project_name",
        ('mig_ln_' || substr(md5(akb."id"), 1, 24)) AS output_id,
        ('mig_ln_cfg_' || substr(md5(alk."id"), 1, 24)) AS output_config_id
    FROM "automation_knowledge_bases" akb
    INNER JOIN "automation_linear_kb_configs" alk
        ON alk."automation_knowledge_base_id" = akb."id"
    WHERE akb."config_type" = 'LINEAR'
)
INSERT INTO "automation_linear_configs" ("id", "automation_output_id", "team_id", "team_name", "project_id", "project_name", "created_at", "updated_at")
SELECT
    lk."output_config_id",
    lk."output_id",
    lk."team_id",
    lk."team_name",
    lk."project_id",
    lk."project_name",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM linear_kb lk
WHERE EXISTS (
    SELECT 1 FROM "automation_outputs" ao WHERE ao."id" = lk."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;

-- Data migration: create Slack outputs/configs from legacy KB rows (supports multiple channels)
WITH slack_kb_base AS (
    SELECT
        akb."id" AS kb_id,
        askb."id" AS kb_config_id,
        akb."automation_id",
        akb."integration_id",
        askb."channel_ids",
        askb."channel_names",
        askb."allow_dms",
        askb."user_ids"
    FROM "automation_knowledge_bases" akb
    INNER JOIN "automation_slack_kb_configs" askb
        ON askb."automation_knowledge_base_id" = akb."id"
    WHERE akb."config_type" = 'SLACK'
),
slack_channel_rows AS (
    SELECT
        skb."kb_id",
        skb."kb_config_id",
        skb."automation_id",
        skb."integration_id",
        skb."channel_ids"[idx] AS channel_id,
        CASE
            WHEN idx <= COALESCE(array_length(skb."channel_names", 1), 0) THEN skb."channel_names"[idx]
            ELSE NULL
        END AS channel_name,
        ARRAY[]::TEXT[] AS user_ids,
        ('mig_sl_' || substr(md5(skb."kb_id" || ':' || skb."channel_ids"[idx]), 1, 24)) AS output_id,
        ('mig_sl_cfg_' || substr(md5(skb."kb_config_id" || ':' || skb."channel_ids"[idx]), 1, 24)) AS output_config_id
    FROM slack_kb_base skb
    CROSS JOIN LATERAL generate_subscripts(skb."channel_ids", 1) AS idx
),
slack_dm_rows AS (
    SELECT
        skb."kb_id",
        skb."kb_config_id",
        skb."automation_id",
        skb."integration_id",
        NULL::TEXT AS channel_id,
        NULL::TEXT AS channel_name,
        skb."user_ids" AS user_ids,
        ('mig_sl_' || substr(md5(skb."kb_id" || ':dm:' || array_to_string(skb."user_ids", ',')), 1, 24)) AS output_id,
        ('mig_sl_cfg_' || substr(md5(skb."kb_config_id" || ':dm:' || array_to_string(skb."user_ids", ',')), 1, 24)) AS output_config_id
    FROM slack_kb_base skb
    WHERE skb."allow_dms" = TRUE
      AND COALESCE(array_length(skb."user_ids", 1), 0) > 0
),
slack_candidates AS (
    SELECT * FROM slack_channel_rows
    UNION ALL
    SELECT * FROM slack_dm_rows
),
slack_to_migrate AS (
    SELECT *
    FROM slack_candidates sc
    WHERE NOT EXISTS (
        SELECT 1
        FROM "automation_outputs" ao
        INNER JOIN "automation_slack_configs" ascf
            ON ascf."automation_output_id" = ao."id"
        WHERE ao."automation_id" = sc."automation_id"
          AND ao."integration_id" = sc."integration_id"
          AND ao."config_type" = 'SLACK_CHANNEL'::"OutputConfigType"
          AND ascf."channel_id" IS NOT DISTINCT FROM sc."channel_id"
          AND ascf."user_ids" = sc."user_ids"
    )
)
INSERT INTO "automation_outputs" ("id", "automation_id", "read_only", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    stm."output_id",
    stm."automation_id",
    true,
    'SLACK_CHANNEL'::"OutputConfigType",
    stm."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM slack_to_migrate stm
ON CONFLICT ("id") DO NOTHING;

WITH slack_kb_base AS (
    SELECT
        akb."id" AS kb_id,
        askb."id" AS kb_config_id,
        askb."channel_ids",
        askb."channel_names",
        askb."allow_dms",
        askb."user_ids"
    FROM "automation_knowledge_bases" akb
    INNER JOIN "automation_slack_kb_configs" askb
        ON askb."automation_knowledge_base_id" = akb."id"
    WHERE akb."config_type" = 'SLACK'
),
slack_channel_rows AS (
    SELECT
        skb."kb_id",
        skb."kb_config_id",
        skb."channel_ids"[idx] AS channel_id,
        CASE
            WHEN idx <= COALESCE(array_length(skb."channel_names", 1), 0) THEN skb."channel_names"[idx]
            ELSE NULL
        END AS channel_name,
        ARRAY[]::TEXT[] AS user_ids,
        ('mig_sl_' || substr(md5(skb."kb_id" || ':' || skb."channel_ids"[idx]), 1, 24)) AS output_id,
        ('mig_sl_cfg_' || substr(md5(skb."kb_config_id" || ':' || skb."channel_ids"[idx]), 1, 24)) AS output_config_id
    FROM slack_kb_base skb
    CROSS JOIN LATERAL generate_subscripts(skb."channel_ids", 1) AS idx
),
slack_dm_rows AS (
    SELECT
        skb."kb_id",
        skb."kb_config_id",
        NULL::TEXT AS channel_id,
        NULL::TEXT AS channel_name,
        skb."user_ids" AS user_ids,
        ('mig_sl_' || substr(md5(skb."kb_id" || ':dm:' || array_to_string(skb."user_ids", ',')), 1, 24)) AS output_id,
        ('mig_sl_cfg_' || substr(md5(skb."kb_config_id" || ':dm:' || array_to_string(skb."user_ids", ',')), 1, 24)) AS output_config_id
    FROM slack_kb_base skb
    WHERE skb."allow_dms" = TRUE
      AND COALESCE(array_length(skb."user_ids", 1), 0) > 0
),
slack_candidates AS (
    SELECT * FROM slack_channel_rows
    UNION ALL
    SELECT * FROM slack_dm_rows
)
INSERT INTO "automation_slack_configs" ("id", "automation_output_id", "channel_id", "channel_name", "listen_to_user_dms", "user_ids", "created_at", "updated_at")
SELECT
    sc."output_config_id",
    sc."output_id",
    sc."channel_id",
    sc."channel_name",
    false,
    sc."user_ids",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM slack_candidates sc
WHERE EXISTS (
    SELECT 1 FROM "automation_outputs" ao WHERE ao."id" = sc."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;
