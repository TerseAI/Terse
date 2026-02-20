#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MIGRATION_ID="20260220030001_unique_constraint_event_key"

# Load DATABASE_URL
source .env

# Restore schema on exit
trap 'git checkout prisma/schema.prisma 2>/dev/null || true' EXIT

# 1. Deploy migrations (will fail on unique constraint)
pnpm exec prisma migrate deploy || true

# 2. Make event_key optional so backfill can run
sed -i '' 's/event_key[[:space:]]*String[[:space:]]*@unique/event_key             String?/g' prisma/schema.prisma

# 3. Regenerate client
pnpm exec prisma generate

# 4. Run backfill
npx tsx scripts/backfill-events.ts

# 5. Restore schema
git checkout prisma/schema.prisma
pnpm exec prisma generate

# 6. Roll back the failed migration
npx prisma migrate resolve --rolled-back "$MIGRATION_ID"

# 7. Dedup both tables
for TABLE in run_history_raw_events chat_raw_events; do
  psql "$DATABASE_URL" -c "
    WITH dupes AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY event_key ORDER BY created_at) as rn
      FROM ${TABLE}
      WHERE event_key IN (SELECT event_key FROM ${TABLE} GROUP BY 1 HAVING COUNT(1) > 1)
    )
    DELETE FROM ${TABLE} WHERE id IN (SELECT id FROM dupes WHERE rn > 1);
  "
done

# 8. Re-run migration (should pass)
pnpm exec prisma migrate deploy

echo "Done!"
