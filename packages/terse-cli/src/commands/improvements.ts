import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ApiRoutes, buildRoute } from "terse-types"
import type { Agent, AgentImprovement, AgentsResponse, GetAgentImprovementsResponse } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { createSpinner } from "../cliUi.js"

type AgentWithImprovements = {
    agent: Agent
    improvements: AgentImprovement[]
}

export async function applyImprovement(improvementId?: string): Promise<void> {
    intro("terse apply")

    const apiKey = readApiKeyOrBail()

    const spinner = createSpinner()
    spinner.start("Fetching agents and improvements")
    const agentsWithImprovements = await fetchAgentsWithImprovements(apiKey)
    spinner.stop(`Loaded ${agentsWithImprovements.length} agent${agentsWithImprovements.length === 1 ? "" : "s"}`)

    const target = improvementId ? findImprovementById(agentsWithImprovements, improvementId) : await promptForImprovement(agentsWithImprovements)

    if (!target) {
        log.error(improvementId ? `No pending improvement found with id ${chalk.cyan(improvementId)}` : "No improvement selected")
        process.exit(1)
    }

    const { agent, improvement } = target
    await applyPatchLocallyAndMarkApplied(apiKey, agent, improvement)

    outro("Done")
}

export async function listImprovements(): Promise<void> {
    const apiKey = readApiKeyOrBail()

    const spinner = createSpinner()
    spinner.start("Fetching agents and improvements")
    const agentsWithImprovements = await fetchAgentsWithImprovements(apiKey)
    spinner.stop(`Loaded ${agentsWithImprovements.length} agent${agentsWithImprovements.length === 1 ? "" : "s"}`)

    const pendingTotal = agentsWithImprovements.reduce((sum, { improvements }) => sum + pendingOnly(improvements).length, 0)
    if (pendingTotal === 0) {
        console.log(chalk.dim("  No pending improvements."))
        return
    }

    for (const { agent, improvements } of agentsWithImprovements) {
        const pending = pendingOnly(improvements)
        if (pending.length === 0) continue

        console.log("")
        console.log(`${chalk.bold(agent.name)} ${chalk.dim(`(${pending.length} pending)`)}`)
        for (const improvement of pending) {
            printImprovementDetails(improvement, "  ")
        }
    }
    console.log("")
}

async function promptForImprovement(agentsWithImprovements: AgentWithImprovements[]): Promise<{ agent: Agent; improvement: AgentImprovement } | null> {
    if (agentsWithImprovements.length === 0) {
        log.warn("No agents found. Deploy an agent first with `terse deploy`.")
        return null
    }

    const longestName = agentsWithImprovements.reduce((max, { agent }) => Math.max(max, agent.name.length), 0)

    const agentId = abortIfCancelled(
        await select<string>({
            message: "Choose an agent",
            options: agentsWithImprovements.map(({ agent, improvements }) => {
                const pending = pendingOnly(improvements).length
                const countLabel = `${pending} pending improvement${pending === 1 ? "" : "s"}`
                return {
                    value: agent.id,
                    label: `${agent.name.padEnd(longestName)}  ${chalk.dim(countLabel)}`
                }
            })
        })
    )

    const selected = agentsWithImprovements.find(({ agent }) => agent.id === agentId)
    if (!selected) return null

    const pending = pendingOnly(selected.improvements)
    if (pending.length === 0) {
        log.warn(`${selected.agent.name} has no pending improvements.`)
        return null
    }

    console.log("")
    console.log(chalk.bold(`Pending improvements for ${selected.agent.name}:`))
    for (const improvement of pending) {
        printImprovementDetails(improvement, "  ")
    }
    console.log("")

    const improvementId = abortIfCancelled(
        await select<string>({
            message: "Choose an improvement",
            options: pending.map(improvement => ({
                value: improvement.id,
                label: improvement.title,
                hint: formatImprovementMeta(improvement)
            }))
        })
    )

    const improvement = pending.find(i => i.id === improvementId)
    if (!improvement) return null

    return { agent: selected.agent, improvement }
}

function findImprovementById(agentsWithImprovements: AgentWithImprovements[], improvementId: string): { agent: Agent; improvement: AgentImprovement } | null {
    for (const { agent, improvements } of agentsWithImprovements) {
        const match = improvements.find(i => i.id === improvementId)
        if (match) return { agent, improvement: match }
    }
    return null
}

async function fetchAgentsWithImprovements(apiKey: string): Promise<AgentWithImprovements[]> {
    const agentsResponse = await fetchWithAuth<AgentsResponse>(`${ApiRoutes.AGENTS.LIST}?pageSize=100`, apiKey)
    const agents = agentsResponse.agents

    const results = await Promise.all(
        agents.map(async agent => {
            try {
                const response = await fetchWithAuth<GetAgentImprovementsResponse>(buildRoute(ApiRoutes.IMPROVEMENTS.BY_AGENT_ID, { agentId: agent.id }), apiKey)
                return { agent, improvements: response.improvements }
            } catch {
                return { agent, improvements: [] as AgentImprovement[] }
            }
        })
    )

    return results.sort((a, b) => pendingOnly(b.improvements).length - pendingOnly(a.improvements).length || a.agent.name.localeCompare(b.agent.name))
}

async function applyPatchLocallyAndMarkApplied(apiKey: string, agent: Agent, improvement: AgentImprovement): Promise<void> {
    if (!improvement.suggestedPatch) {
        log.error("This improvement has no downloadable patch.")
        process.exit(1)
    }

    log.info(`Applying ${chalk.bold(improvement.title)} for ${chalk.cyan(agent.name)}`)

    const patchPath = writePatchToTempFile(improvement)
    try {
        runGitApply(patchPath)
        log.success(`Patch applied from ${chalk.dim(patchPath)}`)
    } catch (error) {
        log.error(`git apply failed: ${error instanceof Error ? error.message : String(error)}`)
        console.log(chalk.dim(`  The patch file remains at ${patchPath} so you can try applying it manually.`))
        process.exit(1)
    }

    const spinner = createSpinner()
    spinner.start("Marking improvement as applied")
    try {
        await fetchWithAuth(buildRoute(ApiRoutes.IMPROVEMENTS.APPLY, { agentId: agent.id, id: improvement.id }), apiKey, {}, "POST")
        spinner.stop("Marked as applied")
    } catch (error) {
        spinner.stop("Failed to mark as applied on server")
        console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`))
    }
}

function writePatchToTempFile(improvement: AgentImprovement): string {
    const safeName =
        improvement.title
            .replace(/[^a-zA-Z0-9-_ ]/g, "")
            .replace(/\s+/g, "-")
            .toLowerCase() || "improvement"
    const fileName = `${safeName}-${improvement.id}.patch`
    const filePath = path.join(os.tmpdir(), fileName)
    const content = improvement.suggestedPatch!.endsWith("\n") ? improvement.suggestedPatch! : `${improvement.suggestedPatch}\n`
    fs.writeFileSync(filePath, content, "utf8")
    return filePath
}

function runGitApply(patchPath: string): void {
    execFileSync("git", ["apply", patchPath], { stdio: "inherit" })
}

function pendingOnly(improvements: AgentImprovement[]): AgentImprovement[] {
    return improvements.filter(i => i.status === "PENDING")
}

function printImprovementDetails(improvement: AgentImprovement, indent: string): void {
    console.log("")
    console.log(`${indent}${chalk.cyan.bold(improvement.title)}  ${chalk.dim(formatImprovementMeta(improvement))}`)
    for (const line of wrapText(improvement.description.trim(), 100)) {
        console.log(`${indent}${line}`)
    }
}

function formatImprovementMeta(improvement: AgentImprovement): string {
    const confidencePct = Math.round(improvement.confidence * 100)
    return `${confidencePct}% confidence`
}

function wrapText(value: string, width: number): string[] {
    const lines: string[] = []
    for (const paragraph of value.split(/\n+/)) {
        const words = paragraph.split(/\s+/).filter(Boolean)
        let current = ""
        for (const word of words) {
            if (current.length === 0) {
                current = word
            } else if (current.length + 1 + word.length > width) {
                lines.push(current)
                current = word
            } else {
                current += ` ${word}`
            }
        }
        if (current.length > 0) lines.push(current)
    }
    return lines
}

function abortIfCancelled<T>(value: T | symbol): T {
    if (isCancel(value)) {
        cancel("Operation cancelled.")
        process.exit(0)
    }
    return value as T
}
