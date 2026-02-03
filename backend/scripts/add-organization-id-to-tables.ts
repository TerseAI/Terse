import { Prisma } from "@prisma/client";
import { WorkOS } from "@workos-inc/node";
import { db } from "../src/prismaClient";

import "dotenv/config";

const prisma = db();

const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

// All tables that have both user_id and organization_id columns
const TABLES_WITH_ORGANIZATION_ID = [
  "github_app_tokens",
  "linear_integrations",
  "user_slack_integrations",
  "atlassian_integrations",
  "gmail_integrations",
  "notion_integrations",
  "figma_integrations",
  "posthog_integrations",
  "launchdarkly_integrations",
  "datadog_integrations",
  "automations",
] as const;

async function main() {
  const organizationIdMapping = await getOrganizationIdMapping();

  console.log(
    `Found ${
      Object.keys(organizationIdMapping).length
    } user -> organization mappings`,
  );

  if (Object.keys(organizationIdMapping).length === 0) {
    console.log("No mappings found, nothing to update");
    return;
  }

  // Update all tables with organization_id
  for (const tableName of TABLES_WITH_ORGANIZATION_ID) {
    await backfillOrganizationIdForTable(tableName, organizationIdMapping);
  }

  console.log("Backfill complete!");
}

/**
 * Efficiently updates organization_id for all rows in a table based on user_id mapping.
 * Uses PostgreSQL's UPDATE ... FROM (VALUES ...) pattern for bulk updates.
 */
async function backfillOrganizationIdForTable(
  tableName: string,
  organizationIdMapping: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(organizationIdMapping);

  if (entries.length === 0) {
    console.log(`[${tableName}] No mappings to apply`);
    return;
  }

  // Build VALUES clause: ('user_id_1', 'org_id_1'), ('user_id_2', 'org_id_2'), ...
  const valuesClause = entries
    .map(([userId, orgId]) => `('${userId}', '${orgId}')`)
    .join(", ");

  // PostgreSQL UPDATE ... FROM pattern for efficient bulk updates
  const sql = Prisma.sql`
    UPDATE ${Prisma.raw(`"${tableName}"`)} AS t
    SET organization_id = v.organization_id
    FROM (VALUES ${Prisma.raw(valuesClause)}) AS v(user_id, organization_id)
    WHERE t.user_id = v.user_id
      AND t.organization_id IS NULL
  `;

  try {
    const result = await prisma.$executeRaw(sql);
    console.log(`[${tableName}] Updated ${result} rows`);
  } catch (error) {
    console.error(`[${tableName}] Error updating:`, error);
    throw error;
  }
}

async function getOrganizationIdMapping(): Promise<Record<string, string>> {
  const organizationIdMapping: Record<string, string> = {};
  const users = await prisma.users.findMany({});

  console.log(`Processing ${users.length} users...`);

  for (const user of users) {
    try {
      const workosUser = await workos.userManagement.getUser(user.workos_id);
      const workosUserMemberships =
        await workos.userManagement.listOrganizationMemberships({
          userId: user.workos_id,
        });

      if (!workosUser) {
        console.error(`Workos user not found for user ${user.id}`);
        continue;
      }

      if (workosUserMemberships.data.length === 0) {
        console.error(`Workos user ${user.workos_id} has no memberships`);
        continue;
      }

      if (workosUserMemberships.data.length > 1) {
        console.error(
          `Workos user ${user.workos_id} has multiple memberships, using first one`,
        );
      }

      const organizationId = workosUserMemberships.data[0].organizationId;
      organizationIdMapping[user.id] = organizationId;
    } catch (error) {
      console.error(`Error fetching WorkOS data for user ${user.id}:`, error);
    }
  }

  return organizationIdMapping;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
