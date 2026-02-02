/**
 * Creates a user + organization for each user in the database.
 */

import { PrismaClient } from "@prisma/client";
import { WorkOS } from "@workos-inc/node";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

const ORG_NAME_DICTIONARY_PATH =
  process.env.ORG_NAME_DICTIONARY_PATH ||
  path.join(__dirname, "org-name-dictionary.json");

function parseDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

type NameDictionary = Record<string, string>;

function loadNameDictionary(): NameDictionary {
  try {
    const raw = fs.readFileSync(ORG_NAME_DICTIONARY_PATH, "utf-8");
    return JSON.parse(raw) as NameDictionary;
  } catch {
    return {};
  }
}

function getOrgNameForUser(
  user: { id: string; email: string },
  dictionary: NameDictionary,
): string {
  const byEmail = dictionary[user.email];
  if (byEmail) return byEmail;
  throw new Error(`No org name found for user ${user.email}`);
}

async function main() {
  const users = await prisma.users.findMany({
    where: {
      workos_id: null,
      email: {
        not: {
          // We don't want to migrate placeholder users.
          endsWith: "@username.ai",
        },
      },
    },
    orderBy: { created_at: "asc" },
  });
  console.log(
    `Found ${users.length} users to migrate (excluding @username.ai)`,
  );

  for (const user of users) {
    try {
      const { firstName, lastName } = parseDisplayName(user.display_name);
      const workosUser = await workos.userManagement.createUser({
        email: user.email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        emailVerified: true,
      });

      const dictionary = loadNameDictionary();
      if (Object.keys(dictionary).length > 0) {
        console.log(`Loaded name dictionary from ${ORG_NAME_DICTIONARY_PATH}`);
      }

      const orgName = getOrgNameForUser(user, dictionary);
      const organization = await workos.organizations.createOrganization({
        name: orgName,
      });

      await workos.userManagement.createOrganizationMembership({
        organizationId: organization.id,
        userId: workosUser.id,
        roleSlug: "admin",
      });

      await prisma.users.update({
        where: { id: user.id },
        data: { workos_id: workosUser.id },
      });
      console.log(`Migrated: ${user.email} -> ${workosUser.id}`);
    } catch (err) {
      console.error(`Failed to migrate ${user.email}:`, err);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
