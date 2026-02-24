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

-- Data migration: GitHub KB rows -> outputs/configs
DROP TABLE IF EXISTS tmp_kb_github_candidates;
CREATE TEMP TABLE tmp_kb_github_candidates AS
SELECT
    akb."id" AS kb_id,
    agk."id" AS kb_config_id,
    akb."automation_id",
    akb."integration_id",
    agk."repository_ids",
    ('mig_gh_' || akb."id") AS output_id,
    ('mig_gh_cfg_' || agk."id") AS output_config_id
FROM "automation_knowledge_bases" akb
INNER JOIN "automation_github_kb_configs" agk
    ON agk."automation_knowledge_base_id" = akb."id"
WHERE akb."config_type" = 'GITHUB';

INSERT INTO "automation_outputs" ("id", "automation_id",  "config_type", "integration_id", "created_at", "updated_at")
SELECT
    gk."output_id",
    gk."automation_id",
    'GITHUB'::"OutputConfigType",
    gk."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_github_candidates gk
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
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "automation_github_configs" ("id", "automation_output_id", "repository_ids", "created_at", "updated_at")
SELECT
    gk."output_config_id",
    gk."output_id",
    gk."repository_ids",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_github_candidates gk
WHERE EXISTS (
    SELECT 1
    FROM "automation_outputs" ao
    WHERE ao."id" = gk."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;

DROP TABLE IF EXISTS tmp_kb_github_candidates;

-- Data migration: PostHog / Datadog / LaunchDarkly KB rows -> outputs
DROP TABLE IF EXISTS tmp_kb_single_output_candidates;
CREATE TEMP TABLE tmp_kb_single_output_candidates AS
SELECT
    apc."automation_knowledge_base_id" AS kb_id,
    akb."automation_id",
    akb."integration_id",
    ('mig_ph_' || apc."automation_knowledge_base_id") AS output_id,
    'POSTHOG'::"OutputConfigType" AS output_type
FROM "automation_posthog_configs" apc
INNER JOIN "automation_knowledge_bases" akb
    ON akb."id" = apc."automation_knowledge_base_id"
WHERE apc."automation_knowledge_base_id" IS NOT NULL

UNION ALL

SELECT
    adc."automation_knowledge_base_id" AS kb_id,
    akb."automation_id",
    akb."integration_id",
    ('mig_dd_' || adc."automation_knowledge_base_id") AS output_id,
    'DATADOG'::"OutputConfigType" AS output_type
FROM "automation_datadog_configs" adc
INNER JOIN "automation_knowledge_bases" akb
    ON akb."id" = adc."automation_knowledge_base_id"
WHERE adc."automation_knowledge_base_id" IS NOT NULL

UNION ALL

SELECT
    alc."automation_knowledge_base_id" AS kb_id,
    akb."automation_id",
    akb."integration_id",
    ('mig_ld_' || alc."automation_knowledge_base_id") AS output_id,
    'LAUNCHDARKLY'::"OutputConfigType" AS output_type
FROM "automation_launchdarkly_configs" alc
INNER JOIN "automation_knowledge_bases" akb
    ON akb."id" = alc."automation_knowledge_base_id"
WHERE alc."automation_knowledge_base_id" IS NOT NULL;

INSERT INTO "automation_outputs" ("id", "automation_id", "config_type", "integration_id", "created_at", "updated_at")
SELECT
    soc."output_id",
    soc."automation_id",
    soc."output_type",
    soc."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_single_output_candidates soc
ON CONFLICT ("id") DO NOTHING;

UPDATE "automation_posthog_configs" apc
SET "automation_output_id" = soc."output_id"
FROM tmp_kb_single_output_candidates soc
WHERE soc."output_type" = 'POSTHOG'::"OutputConfigType"
  AND soc."kb_id" = apc."automation_knowledge_base_id"
  AND apc."automation_output_id" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "automation_outputs" ao
      WHERE ao."id" = soc."output_id"
  );

UPDATE "automation_datadog_configs" adc
SET "automation_output_id" = soc."output_id"
FROM tmp_kb_single_output_candidates soc
WHERE soc."output_type" = 'DATADOG'::"OutputConfigType"
  AND soc."kb_id" = adc."automation_knowledge_base_id"
  AND adc."automation_output_id" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "automation_outputs" ao
      WHERE ao."id" = soc."output_id"
  );

UPDATE "automation_launchdarkly_configs" alc
SET "automation_output_id" = soc."output_id"
FROM tmp_kb_single_output_candidates soc
WHERE soc."output_type" = 'LAUNCHDARKLY'::"OutputConfigType"
  AND soc."kb_id" = alc."automation_knowledge_base_id"
  AND alc."automation_output_id" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "automation_outputs" ao
      WHERE ao."id" = soc."output_id"
  );

DROP TABLE IF EXISTS tmp_kb_single_output_candidates;

-- Data migration: Linear KB rows -> outputs/configs
DROP TABLE IF EXISTS tmp_kb_linear_candidates;
CREATE TEMP TABLE tmp_kb_linear_candidates AS
SELECT
    akb."id" AS kb_id,
    alk."id" AS kb_config_id,
    akb."automation_id",
    akb."integration_id",
    alk."team_id",
    alk."team_name",
    alk."project_id",
    alk."project_name",
    ('mig_ln_' || akb."id") AS output_id,
    ('mig_ln_cfg_' || alk."id") AS output_config_id
FROM "automation_knowledge_bases" akb
INNER JOIN "automation_linear_kb_configs" alk
    ON alk."automation_knowledge_base_id" = akb."id"
WHERE akb."config_type" = 'LINEAR';

INSERT INTO "automation_outputs" ("id", "automation_id",  "config_type", "integration_id", "created_at", "updated_at")
SELECT
    lk."output_id",
    lk."automation_id",
    'LINEAR_TICKET'::"OutputConfigType",
    lk."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_linear_candidates lk
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
ON CONFLICT ("id") DO NOTHING;

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
FROM tmp_kb_linear_candidates lk
WHERE EXISTS (
    SELECT 1
    FROM "automation_outputs" ao
    WHERE ao."id" = lk."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;

DROP TABLE IF EXISTS tmp_kb_linear_candidates;

-- Data migration: Slack KB rows -> outputs/configs (supports multiple channels)
DROP TABLE IF EXISTS tmp_kb_slack_candidates;
CREATE TEMP TABLE tmp_kb_slack_candidates AS
WITH slack_kb_base AS (
    SELECT
        akb."id" AS kb_id,
        askb."id" AS kb_config_id,
        akb."automation_id",
        akb."integration_id",
        askb."channel_ids",
        askb."channel_names",
        askb."allow_dms",
        ARRAY(
            SELECT DISTINCT uid
            FROM unnest(COALESCE(askb."user_ids", ARRAY[]::TEXT[])) AS uid
            ORDER BY uid
        ) AS user_ids
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
        ('mig_sl_' || skb."kb_id" || ':' || skb."channel_ids"[idx]) AS output_id,
        ('mig_sl_cfg_' || skb."kb_config_id" || ':' || skb."channel_ids"[idx]) AS output_config_id
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
        CASE
            WHEN COALESCE(array_length(skb."user_ids", 1), 0) > 0
                THEN ('mig_sl_' || skb."kb_id" || ':dm:' || array_to_string(skb."user_ids", ','))
            ELSE ('mig_sl_' || skb."kb_id" || ':dm:any')
        END AS output_id,
        CASE
            WHEN COALESCE(array_length(skb."user_ids", 1), 0) > 0
                THEN ('mig_sl_cfg_' || skb."kb_config_id" || ':dm:' || array_to_string(skb."user_ids", ','))
            ELSE ('mig_sl_cfg_' || skb."kb_config_id" || ':dm:any')
        END AS output_config_id
    FROM slack_kb_base skb
    WHERE skb."allow_dms" = TRUE
)
SELECT * FROM slack_channel_rows
UNION ALL
SELECT * FROM slack_dm_rows;

INSERT INTO "automation_outputs" ("id", "automation_id",  "config_type", "integration_id", "created_at", "updated_at")
SELECT
    sc."output_id",
    sc."automation_id",
    'SLACK_CHANNEL'::"OutputConfigType",
    sc."integration_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_slack_candidates sc
WHERE NOT EXISTS (
    SELECT 1
    FROM "automation_outputs" ao
    INNER JOIN "automation_slack_configs" ascf
        ON ascf."automation_output_id" = ao."id"
    WHERE ao."automation_id" = sc."automation_id"
      AND ao."integration_id" = sc."integration_id"
      AND ao."config_type" = 'SLACK_CHANNEL'::"OutputConfigType"
      AND ascf."channel_id" IS NOT DISTINCT FROM sc."channel_id"
      AND ARRAY(
            SELECT DISTINCT uid
            FROM unnest(COALESCE(ascf."user_ids", ARRAY[]::TEXT[])) AS uid
            ORDER BY uid
      ) = ARRAY(
            SELECT DISTINCT uid
            FROM unnest(COALESCE(sc."user_ids", ARRAY[]::TEXT[])) AS uid
            ORDER BY uid
      )
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "automation_slack_configs" ("id", "automation_output_id", "channel_id", "channel_name", "listen_to_user_dms", "user_ids", "created_at", "updated_at")
SELECT
    sc."output_config_id",
    sc."output_id",
    sc."channel_id",
    sc."channel_name",
    sc."channel_id" IS NULL,
    sc."user_ids",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_kb_slack_candidates sc
WHERE EXISTS (
    SELECT 1
    FROM "automation_outputs" ao
    WHERE ao."id" = sc."output_id"
)
ON CONFLICT ("automation_output_id") DO NOTHING;

DROP TABLE IF EXISTS tmp_kb_slack_candidates;
