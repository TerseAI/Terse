-- Enforce one-integration-per-org at the database layer so concurrent
-- form submissions can no longer create duplicate rows (the previous
-- findFirst → branch into create/update pattern is racy without a unique
-- constraint).
--
-- For LaunchDarkly / Datadog / PostHog: one integration per org.
-- For Notion: one integration per (org, workspace) — Notion supports
-- multiple workspaces and the existing schema already carries
-- workspace_id for that purpose.
--
-- Before adding the constraints we dedupe existing rows: when an org
-- already has duplicates we keep the most-recently-created row and
-- delete the rest. Orphaned GSM secrets attached to deleted rows are
-- left for the existing scheduled secret-cleanup sweep (see
-- clearOldSecretVersions) — the migration itself can't reach GSM.
--
-- automation_inputs.integration_id and automation_outputs.integration_id
-- are polymorphic (the resolved table is decided by config_type) and
-- carry no FK back to the per-provider integration tables, so a plain
-- DELETE silently leaves automation rows pointing at deleted duplicates.
-- Each section below repoints those rows to the surviving integration
-- inside the same statement as the delete.

-- ── LaunchDarkly ─────────────────────────────────────────────────────────
WITH ranked AS (
    SELECT
        "id",
        "organization_id",
        ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS rn,
        FIRST_VALUE("id") OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS survivor_id
    FROM "launchdarkly_integrations"
),
duplicates AS (
    SELECT "id", "survivor_id" FROM ranked WHERE rn > 1
),
repoint_outputs AS (
    UPDATE "automation_outputs" ao
    SET "integration_id" = d."survivor_id"
    FROM duplicates d
    WHERE ao."integration_id" = d."id"
      AND ao."config_type" = 'LAUNCHDARKLY'::"OutputConfigType"
    RETURNING 1
)
DELETE FROM "launchdarkly_integrations"
WHERE "id" IN (SELECT "id" FROM duplicates);
CREATE UNIQUE INDEX "launchdarkly_integrations_organization_id_key" ON "launchdarkly_integrations"("organization_id");

-- ── Datadog ──────────────────────────────────────────────────────────────
WITH ranked AS (
    SELECT
        "id",
        "organization_id",
        ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS rn,
        FIRST_VALUE("id") OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS survivor_id
    FROM "datadog_integrations"
),
duplicates AS (
    SELECT "id", "survivor_id" FROM ranked WHERE rn > 1
),
repoint_outputs AS (
    UPDATE "automation_outputs" ao
    SET "integration_id" = d."survivor_id"
    FROM duplicates d
    WHERE ao."integration_id" = d."id"
      AND ao."config_type" = 'DATADOG'::"OutputConfigType"
    RETURNING 1
)
DELETE FROM "datadog_integrations"
WHERE "id" IN (SELECT "id" FROM duplicates);
CREATE UNIQUE INDEX "datadog_integrations_organization_id_key" ON "datadog_integrations"("organization_id");

-- ── PostHog ──────────────────────────────────────────────────────────────
-- PostHog can be both a trigger (InputConfigType.POSTHOG) and an output
-- (OutputConfigType.POSTHOG), so we repoint both sides.
WITH ranked AS (
    SELECT
        "id",
        "organization_id",
        ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS rn,
        FIRST_VALUE("id") OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS survivor_id
    FROM "posthog_integrations"
),
duplicates AS (
    SELECT "id", "survivor_id" FROM ranked WHERE rn > 1
),
repoint_inputs AS (
    UPDATE "automation_inputs" ai
    SET "integration_id" = d."survivor_id"
    FROM duplicates d
    WHERE ai."integration_id" = d."id"
      AND ai."config_type" = 'POSTHOG'::"InputConfigType"
    RETURNING 1
),
repoint_outputs AS (
    UPDATE "automation_outputs" ao
    SET "integration_id" = d."survivor_id"
    FROM duplicates d
    WHERE ao."integration_id" = d."id"
      AND ao."config_type" = 'POSTHOG'::"OutputConfigType"
    RETURNING 1
)
DELETE FROM "posthog_integrations"
WHERE "id" IN (SELECT "id" FROM duplicates);
CREATE UNIQUE INDEX "posthog_integrations_organization_id_key" ON "posthog_integrations"("organization_id");

-- ── Notion (composite key) ───────────────────────────────────────────────
-- Only dedupe rows that have a non-null workspace_id. Legacy rows with
-- workspace_id IS NULL are kept (Postgres treats nulls as distinct in
-- unique indexes, so they don't collide with the new constraint or with
-- each other). Going forward, application code refuses to upsert with a
-- null workspace_id, so no new legacy-null rows can appear.
WITH ranked AS (
    SELECT
        "id",
        "organization_id",
        "workspace_id",
        ROW_NUMBER() OVER (PARTITION BY "organization_id", "workspace_id" ORDER BY "created_at" DESC, "id" DESC) AS rn,
        FIRST_VALUE("id") OVER (PARTITION BY "organization_id", "workspace_id" ORDER BY "created_at" DESC, "id" DESC) AS survivor_id
    FROM "notion_integrations"
    WHERE "workspace_id" IS NOT NULL
),
duplicates AS (
    SELECT "id", "survivor_id" FROM ranked WHERE rn > 1
),
repoint_inputs AS (
    UPDATE "automation_inputs" ai
    SET "integration_id" = d."survivor_id"
    FROM duplicates d
    WHERE ai."integration_id" = d."id"
      AND ai."config_type" IN ('NOTION_PAGE'::"InputConfigType", 'NOTION_DATABASE'::"InputConfigType")
    RETURNING 1
),
repoint_outputs AS (
    UPDATE "automation_outputs" ao
    SET "integration_id" = d."survivor_id"
    FROM duplicates d
    WHERE ao."integration_id" = d."id"
      AND ao."config_type" = 'NOTION'::"OutputConfigType"
    RETURNING 1
)
DELETE FROM "notion_integrations"
WHERE "id" IN (SELECT "id" FROM duplicates);
CREATE UNIQUE INDEX "notion_integrations_organization_id_workspace_id_key" ON "notion_integrations"("organization_id", "workspace_id");
