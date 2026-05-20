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

-- ── LaunchDarkly ─────────────────────────────────────────────────────────
DELETE FROM "launchdarkly_integrations"
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS rn
        FROM "launchdarkly_integrations"
    ) t WHERE rn > 1
);
CREATE UNIQUE INDEX "launchdarkly_integrations_organization_id_key" ON "launchdarkly_integrations"("organization_id");

-- ── Datadog ──────────────────────────────────────────────────────────────
DELETE FROM "datadog_integrations"
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS rn
        FROM "datadog_integrations"
    ) t WHERE rn > 1
);
CREATE UNIQUE INDEX "datadog_integrations_organization_id_key" ON "datadog_integrations"("organization_id");

-- ── PostHog ──────────────────────────────────────────────────────────────
DELETE FROM "posthog_integrations"
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "created_at" DESC, "id" DESC) AS rn
        FROM "posthog_integrations"
    ) t WHERE rn > 1
);
CREATE UNIQUE INDEX "posthog_integrations_organization_id_key" ON "posthog_integrations"("organization_id");

-- ── Notion (composite key) ───────────────────────────────────────────────
-- Only dedupe rows that have a non-null workspace_id. Legacy rows with
-- workspace_id IS NULL are kept (Postgres treats nulls as distinct in
-- unique indexes, so they don't collide with the new constraint or with
-- each other). Going forward, application code refuses to upsert with a
-- null workspace_id, so no new legacy-null rows can appear.
DELETE FROM "notion_integrations"
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "organization_id", "workspace_id" ORDER BY "created_at" DESC, "id" DESC) AS rn
        FROM "notion_integrations"
        WHERE "workspace_id" IS NOT NULL
    ) t WHERE rn > 1
);
CREATE UNIQUE INDEX "notion_integrations_organization_id_workspace_id_key" ON "notion_integrations"("organization_id", "workspace_id");
