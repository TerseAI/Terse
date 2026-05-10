#!/usr/bin/env node
// Test helper: create a new WorkOS organization and add a target user as admin.
//
// Usage:
//   pnpm --filter backend run test:add-org "My Test Org"
//
// Required env (read from backend/.env):
//   WORKOS_API_KEY
//   WORKOS_CLIENT_ID
//   TEST_TARGET_USER_WORKOS_ID   WorkOS user id (user_...) to add as admin

import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { WorkOS } from "@workos-inc/node"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envFile = path.resolve(__dirname, "..", ".env")
dotenv.config({ path: envFile })

const orgName = process.argv.slice(2).join(" ").trim()
if (!orgName) {
    console.error("Usage: pnpm run test:add-org \"<Org Name>\"")
    process.exit(1)
}

const apiKey = process.env.WORKOS_API_KEY
const clientId = process.env.WORKOS_CLIENT_ID
const targetUserId = process.env.TEST_TARGET_USER_WORKOS_ID

const missing = []
if (!apiKey) missing.push("WORKOS_API_KEY")
if (!clientId) missing.push("WORKOS_CLIENT_ID")
if (!targetUserId) missing.push("TEST_TARGET_USER_WORKOS_ID")
if (missing.length > 0) {
    console.error(`Missing required env vars in ${envFile}: ${missing.join(", ")}`)
    process.exit(1)
}

const workos = new WorkOS({ apiKey, clientId })

const org = await workos.organizations.createOrganization({ name: orgName })
console.log(`Created org: ${org.name} (${org.id})`)

await workos.userManagement.createOrganizationMembership({
    organizationId: org.id,
    userId: targetUserId,
    roleSlug: "admin"
})
console.log(`Added user ${targetUserId} as admin of ${org.id}`)
