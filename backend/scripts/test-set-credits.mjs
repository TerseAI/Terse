#!/usr/bin/env node
// Test helper: set the prepaid commit amount on the active Metronome contract
// for a target WorkOS organization. Useful for testing billing limits — set
// the amount to 0 to simulate a fully consumed contract, or any number to
// simulate an arbitrary balance.
//
// Usage:
//   pnpm --filter backend run test:set-credits 0
//   pnpm --filter backend run test:set-credits 4000
//
// Required env (read from backend/.env):
//   WORKOS_API_KEY
//   WORKOS_CLIENT_ID
//   METRONOME_API_KEY                Metronome bearer token
//   TEST_TARGET_WORKOS_ORG_ID        WorkOS org id (org_...) whose contract to edit
//
// Optional env:
//   METRONOME_API_URL                Defaults to https://api.metronome.com

import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { WorkOS } from "@workos-inc/node"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envFile = path.resolve(__dirname, "..", ".env")
dotenv.config({ path: envFile })

const amountArg = process.argv[2]
if (amountArg === undefined) {
    console.error("Usage: pnpm run test:set-credits <amount|inspect>")
    process.exit(1)
}
const inspectMode = amountArg === "inspect"
const amount = inspectMode ? null : Number(amountArg)
if (!inspectMode && (!Number.isFinite(amount) || amount < 0)) {
    console.error(`Invalid amount: ${amountArg}. Must be a non-negative number or "inspect".`)
    process.exit(1)
}

const workosApiKey = process.env.WORKOS_API_KEY
const workosClientId = process.env.WORKOS_CLIENT_ID
const metronomeApiKey = process.env.METRONOME_API_KEY
const orgId = process.env.TEST_TARGET_WORKOS_ORG_ID
const metronomeBaseUrl = (process.env.METRONOME_API_URL ?? "https://api.metronome.com").replace(/\/$/, "")

const missing = []
if (!workosApiKey) missing.push("WORKOS_API_KEY")
if (!workosClientId) missing.push("WORKOS_CLIENT_ID")
if (!metronomeApiKey) missing.push("METRONOME_API_KEY")
if (!orgId) missing.push("TEST_TARGET_WORKOS_ORG_ID")
if (missing.length > 0) {
    console.error(`Missing required env vars in ${envFile}: ${missing.join(", ")}`)
    process.exit(1)
}

const workos = new WorkOS({ apiKey: workosApiKey, clientId: workosClientId })

const org = await workos.organizations.getOrganization(orgId)
const metronomeCustomerId = org.metadata?.metronomeCustomerId
if (!metronomeCustomerId) {
    console.error(`Org ${orgId} has no metronomeCustomerId in WorkOS metadata.`)
    process.exit(1)
}
console.log(`Org: ${org.name} (${orgId}) → Metronome customer ${metronomeCustomerId}`)

async function metronome(pathname, body) {
    const res = await fetch(`${metronomeBaseUrl}${pathname}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${metronomeApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    const text = await res.text()
    if (!res.ok) {
        throw new Error(`Metronome ${pathname} failed (${res.status}): ${text}`)
    }
    console.log(`  ← ${pathname} ${res.status}: ${text.slice(0, 400)}`)
    return text ? JSON.parse(text) : {}
}

const listResponse = await metronome("/v2/contracts/list", { customer_id: metronomeCustomerId })
const contracts = listResponse.data ?? []
const now = Date.now()
const activeContract = contracts.find(c => {
    const start = c.starting_at ? new Date(c.starting_at).getTime() : 0
    const end = c.ending_before ? new Date(c.ending_before).getTime() : Infinity
    return start <= now && now < end
}) ?? contracts[0]

if (!activeContract) {
    console.error(`No contracts found for customer ${metronomeCustomerId}.`)
    process.exit(1)
}
console.log(`Contract: ${activeContract.id}`)

if (inspectMode) {
    console.log("\n--- recurring_commits ---")
    console.log(JSON.stringify(activeContract.recurring_commits ?? [], null, 2))
    console.log("\n--- commits ---")
    console.log(JSON.stringify(activeContract.commits ?? [], null, 2))
    process.exit(0)
}

const recurringCommits = activeContract.recurring_commits ?? []
const commits = activeContract.commits ?? []
if (recurringCommits.length === 0 && commits.length === 0) {
    console.error("Active contract has no commits or recurring_commits to update.")
    console.error(JSON.stringify(activeContract, null, 2))
    process.exit(1)
}

const update_recurring_commits = recurringCommits.map(rc => {
    console.log(`Recurring commit ${rc.id}: access_amount.quantity ${rc.access_amount?.quantity} → ${amount}`)
    return {
        recurring_commit_id: rc.id,
        access_amount: { quantity: amount }
    }
})

const update_commits = commits
    .map(c => {
        const items = c.access_schedule?.schedule_items ?? []
        if (items.length === 0) return null
        for (const item of items) {
            console.log(`Commit ${c.id} schedule item ${item.id}: ${item.amount} → ${amount}`)
        }
        return {
            commit_id: c.id,
            access_schedule: {
                update_schedule_items: items.map(item => ({ id: item.id, amount }))
            }
        }
    })
    .filter(Boolean)

await metronome("/v2/contracts/edit", {
    customer_id: metronomeCustomerId,
    contract_id: activeContract.id,
    ...(update_recurring_commits.length > 0 ? { update_recurring_commits } : {}),
    ...(update_commits.length > 0 ? { update_commits } : {})
})

console.log(`Done.`)
