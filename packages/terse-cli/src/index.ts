#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"

import { getCliVersion } from "./cliVersion.js"
import { attach } from "./commands/attach.js"
import { loginAndPersist, logout } from "./commands/auth.js"
import { openDashboard } from "./commands/dashboard.js"
import { deploy } from "./commands/deploy.js"
import { openDocs } from "./commands/docs.js"
import { generate } from "./commands/generate.js"
import { history } from "./commands/history.js"
import { init } from "./commands/init.js"
import { integrate } from "./commands/integrate.js"
import { replay } from "./commands/replay.js"
import { run } from "./commands/run.js"
import { test } from "./commands/test.js"
import { isCliRunCommandEnabled } from "./env.js"
import { isPromptCancellationError } from "./promptErrors.js"
import { resolveProvider } from "./providers/resolveProvider.js"

const program = new Command()

program.name("terse").description("The Terse CLI — create and manage Terse projects").version(getCliVersion())

program.commandsGroup("Getting started:")
program
    .command("init")
    .description("Create a new Terse project")
    .argument("[project-name]", "Name for the project directory")
    .action(async (projectName?: string) => {
        const language = "ts"
        const provider = resolveProvider({ command: "init", language })
        await init(projectName, provider)
    })
program
    .command("attach")
    .description("Add Terse to an existing project (self-hosted)")
    .action(async () => {
        await attach()
    })
program
    .command("test")
    .description("Fetch sample events and run a job interactively")
    .argument("[job-name]", "Name of the job to test (auto-selects if only one exists)")
    .option("-v, --verbose", "Show agent stream output", true)
    .option("--entry-file <path>", "Path to the job entry file (overrides default)")
    .action(async (jobName?: string, opts?: { verbose?: boolean; entryFile?: string }) => {
        await test(jobName, opts?.verbose, resolveProvider(), opts?.entryFile)
    })
program
    .command("deploy")
    .description("Deploy all jobs to Terse (syncs with server — removed jobs are deleted)")
    .option("--entry-file <path>", "Path to the job entry file (overrides default)")
    .action(async (opts?: { entryFile?: string }) => {
        await deploy(resolveProvider(), opts?.entryFile)
    })

program.commandsGroup("Build with workspace context:")
program
    .command("integrate")
    .description("Open the integrations page in the Terse Web UI")
    .action(async () => {
        await integrate()
    })
program
    .command("generate")
    .description("Autogenerate context from your connected workspaces")
    .action(async () => {
        await generate(resolveProvider())
    })

if (isCliRunCommandEnabled()) {
    program.commandsGroup("Sandbox:")
    program
        .command("run")
        .description("Execute a job with payload")
        .argument("[job-name]", "Name of the job to run (auto-selects if only one exists)")
        .option("--event <json>", "Serialized event JSON string")
        .option("--event-file <path>", "Path to a JSON file containing the serialized event")
        .option("--entry-file <path>", "Path to the job entry file (overrides default)")
        .action(async (jobName?: string, opts?: { event?: string; eventFile?: string; entryFile?: string }) => {
            await run(jobName, opts?.event, opts?.eventFile, resolveProvider(), opts?.entryFile)
        })
}

program.commandsGroup("Observability:")
program
    .command("replay")
    .description("Replay a run locally on your machine")
    .argument("[run-id]", "ID of the run to re-trigger")
    .action(async (runId: string) => {
        await replay(runId)
    })
program
    .command("history")
    .description("View past run events for a job (use --json to pipe into tooling like the Claude Code /improve skill)")
    .argument("[job-name]", "Name of the job to view the history of")
    .option("--json", "Output runs as JSON for machine consumption")
    .option("--limit <n>", "Max runs to fetch (default 20, max 100)", v => parseInt(v, 10))
    .option("--page <n>", "Page number (1-indexed)", v => parseInt(v, 10))
    .option("--status <list>", "Comma-separated statuses (success,failed,cancelled,skipped,in_progress,awaiting_approval)")
    .option("--since <iso>", "Only include runs at or after this ISO timestamp")
    .option("--until <iso>", "Only include runs at or before this ISO timestamp")
    .option("--query <q>", "Free-text search across trigger, decision and event fields")
    .option("--triggers", "Also fetch the input trigger event JSON for each run (cheap, recommended for /improve)")
    .option("--events", "Also fetch the full model event stream for each run (heavy, includes trigger event)")
    .option("--run-id <id>", "Show full chat events for a single run instead of a list")
    .action(
        async (
            jobName: string | undefined,
            opts: {
                json?: boolean
                limit?: number
                page?: number
                status?: string
                since?: string
                until?: string
                query?: string
                triggers?: boolean
                events?: boolean
                runId?: string
            }
        ) => {
            await history(jobName, opts)
        }
    )
program
    .command("dashboard")
    .description("Open the Terse web app in your browser")
    .action(() => {
        openDashboard()
    })

program.commandsGroup("Authentication:")
program
    .command("login")
    .description("Login to Terse")
    .action(async () => {
        const result = await loginAndPersist()
        if (!result) process.exit(1)
    })
program
    .command("logout")
    .description("Logout of Terse")
    .action(() => {
        const removed = logout()
        if (removed) {
            console.log(chalk.green("  Logged out."))
        } else {
            console.log(chalk.dim("  Not logged in."))
        }
    })

program.commandsGroup("Getting help:")
program
    .command("docs")
    .description("Open Terse documentation in your browser")
    .action(() => {
        openDocs()
    })
program.helpCommand(true)

try {
    await program.parseAsync()
} catch (error) {
    if (isPromptCancellationError(error)) {
        console.log(chalk.yellow("\n  Cancelled.\n"))
        process.exit(130)
    }

    throw error
}
