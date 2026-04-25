#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"

import { CliError, emitCliError, isCliError, setErrorOutputJson } from "./cliError.js"
import { NonInteractiveOpts, collectKeyValue, parseIntFlag } from "./cliHelpers.js"
import { getCliVersion } from "./cliVersion.js"
import { attach } from "./commands/attach.js"
import { loginAndPersist, logout } from "./commands/auth.js"
import { openDashboard } from "./commands/dashboard.js"
import { deploy } from "./commands/deploy.js"
import { openDocs } from "./commands/docs.js"
import { generate } from "./commands/generate.js"
import { history } from "./commands/history.js"
import { applyImprovement, listImprovements } from "./commands/improvements.js"
import { init } from "./commands/init.js"
import { integrate, integrateConnect, integrateDescribe, integrateDisconnect, integrateList, integrateWait } from "./commands/integrate.js"
import { replay } from "./commands/replay.js"
import { run } from "./commands/run.js"
import { test, testList, testRun, testShow } from "./commands/test.js"
import { isCliRunCommandEnabled } from "./env.js"
import { isPromptCancellationError } from "./promptErrors.js"
import { resolveProvider } from "./providers/resolveProvider.js"

const program = new Command()

const NON_INTERACTIVE_OPTION = ["-y, --non-interactive", "Run non-interactively; fail fast if authentication or choices are required"] as const

const ENTRY_FILE_OPTION = ["--entry-file <path>", "Path to the job entry file (overrides default)"] as const

function syncJsonErrorOutput(command: Command): void {
    const { json } = command.opts<JsonOpts>()
    setErrorOutputJson(Boolean(json))
}

program.name("terse").description("The Terse CLI — create and manage Terse projects").version(getCliVersion())
program.hook("preAction", (_thisCommand, actionCommand) => {
    syncJsonErrorOutput(actionCommand)
})

program.commandsGroup("Getting started:")
program
    .command("init")
    .description("Create a new Terse project")
    .argument("[project-name]", "Name for the project directory")
    .option(...NON_INTERACTIVE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse init myproj                       # interactive scaffold
  $ terse init myproj --non-interactive     # non-interactive; requires prior \`terse login\`
  $ terse init myproj < /dev/null           # auto non-interactive (no TTY)
`
    )
    .action(async (projectName?: string, opts?: NonInteractiveOpts) => {
        const language = "ts"
        const provider = resolveProvider({ command: "init", language })
        await init(projectName, provider, opts)
    })
program
    .command("attach")
    .description("Add Terse to an existing project (self-hosted)")
    .option(...NON_INTERACTIVE_OPTION)
    .action(async (opts?: NonInteractiveOpts) => {
        await attach(resolveProvider(), opts)
    })

const testCommand = program
    .command("test")
    .description("Fetch sample events and run a job interactively")
    .argument("[job-name]", "Name of the job to test (auto-selects if only one exists)")
    .option("-v, --verbose", "Show agent stream output", true)
    .option(...ENTRY_FILE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse test                              # interactive picker
  $ terse test my-job                       # test a specific job

Non-interactive subcommands (for AI agents and CI):
  $ terse test list --json                  # enumerate sample events with ids
  $ terse test show <id>                    # inspect a specific sample
  $ terse test run --id <id>                # run a cached sample by content hash
  $ terse test run --event-file sample.json # run a sample event from disk
`
    )
    .action(async (jobName?: string, opts?: EntryFileOpts & { verbose?: boolean }) => {
        await test(jobName, opts?.verbose, resolveProvider(), opts?.entryFile)
    })

testCommand
    .command("list")
    .description("List sample events for a job with content-addressed ids")
    .argument("[job-name]", "Name of the job (auto-selects if only one exists)")
    .option("--json", "Emit JSON with the full event payload for each id")
    .option(...ENTRY_FILE_OPTION)
    .action(async (jobName?: string, opts?: JsonEntryFileOpts) => {
        await testList({ jobName, json: opts?.json, entryFile: opts?.entryFile })
    })

testCommand
    .command("show")
    .description("Show the full contents of a cached sample event")
    .argument("<id>", "Sample event id from `terse test list`")
    .argument("[job-name]", "Name of the job (auto-selects if only one exists)")
    .option("--json", "Emit JSON instead of rendered text")
    .option(...ENTRY_FILE_OPTION)
    .action(async (id: string, jobName?: string, opts?: JsonEntryFileOpts) => {
        await testShow({ id, jobName, json: opts?.json, entryFile: opts?.entryFile })
    })

testCommand
    .command("run")
    .description("Run a job against a sample event non-interactively")
    .argument("[job-name]", "Name of the job (auto-selects if only one exists)")
    .option("--id <id>", "Sample event id from `terse test list`")
    .option("--event <json>", "Inline serialized event JSON string")
    .option("--event-file <path>", "Path to a JSON file containing the serialized event")
    .option("-v, --verbose", "Show agent stream output", true)
    .option(...ENTRY_FILE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse test list --json | jq -r '.events[0].id' | xargs -I{} terse test run --id {}
  $ terse test run --event-file fixture.json
`
    )
    .action(async (jobName?: string, opts?: { id?: string; event?: string; eventFile?: string; verbose?: boolean; entryFile?: string }) => {
        await testRun({
            jobName,
            id: opts?.id,
            eventJson: opts?.event,
            eventFile: opts?.eventFile,
            verbose: opts?.verbose,
            entryFile: opts?.entryFile
        })
    })

program
    .command("deploy")
    .description("Deploy all jobs to Terse (syncs with server — removed jobs are deleted)")
    .option(...ENTRY_FILE_OPTION)
    .action(async (opts?: EntryFileOpts) => {
        await deploy(resolveProvider(), opts?.entryFile)
    })

program.commandsGroup("Build with workspace context:")

const integrateCommand = program
    .command("integrate")
    .description("Connect and manage integrations")
    .addHelpText(
        "after",
        `
Examples:
  $ terse integrate                                   # interactive picker
  $ terse integrate list --json                       # enumerate integrations
  $ terse integrate describe snowflake --json         # see required fields
  $ terse integrate connect snowflake --field account=x --field username=y --fields-stdin <<< '{"password":"'"$PW"'"}'
  $ terse integrate connect slack                     # OAuth → opens browser, exit 2 (follow up with 'wait')
  $ terse integrate wait slack --timeout 300          # block until OAuth completes
  $ terse integrate disconnect snowflake
`
    )
    .action(async () => {
        await integrate()
    })

integrateCommand
    .command("list")
    .description("List integrations and their connection status")
    .option("--json", "Emit JSON")
    .option("--status <status>", "Filter to `connected` or `disconnected`")
    .action(async (opts: { json?: boolean; status?: string }) => {
        if (opts.status && opts.status !== "connected" && opts.status !== "disconnected") {
            throw new CliError("invalid_status_filter", `--status must be "connected" or "disconnected", got "${opts.status}".`)
        }
        await integrateList({ json: opts.json, status: opts.status as "connected" | "disconnected" | undefined })
    })

integrateCommand
    .command("describe")
    .description("Show schema and status for an integration type")
    .argument("<type>", "Integration type (e.g. slack, snowflake)")
    .option("--json", "Emit JSON")
    .action(async (type: string, opts: JsonOpts) => {
        await integrateDescribe({ integrationType: type, json: opts.json })
    })

integrateCommand
    .command("connect")
    .description("Connect (or refresh) an integration. OAuth types open a browser and exit 2 — follow up with `wait` to block.")
    .argument("<type>", "Integration type (e.g. slack, gmail, snowflake)")
    .option("--field <key=value>", "Form field value (repeatable). Never put secrets here — use --fields-stdin.", collectKeyValue, [])
    .option("--fields-stdin", "Read a JSON object of additional fields from stdin (secrets go here)")
    .option("-f, --force", "Re-run the install even if the integration is already connected")
    .option("--json", "Emit JSON")
    .addHelpText(
        "after",
        `
Examples:
  $ terse integrate connect snowflake --field account=xyz --field username=foo --fields-stdin <<< '{"password":"'"$PW"'"}'
  $ terse integrate connect slack                           # OAuth: opens browser, prints URL + wait command, exit 2
  $ terse integrate connect slack --json                    # OAuth: opens browser, emits handoff JSON, exit 2
  $ terse integrate connect snowflake --force               # refresh an existing connection
`
    )
    .action(async (type: string, opts: { field?: string[]; fieldsStdin?: boolean; force?: boolean; json?: boolean }) => {
        await integrateConnect({
            integrationType: type,
            fieldFlags: opts.field,
            fieldsStdin: opts.fieldsStdin,
            force: opts.force,
            json: opts.json
        })
    })

integrateCommand
    .command("disconnect")
    .description("Disconnect an integration")
    .argument("<type>", "Integration type (e.g. slack, snowflake)")
    .option("--json", "Emit JSON")
    .action(async (type: string, opts: JsonOpts) => {
        await integrateDisconnect({ integrationType: type, json: opts.json })
    })

integrateCommand
    .command("wait")
    .description("Block until an OAuth integration finishes connecting (run after `connect` emits a handoff)")
    .argument("<type>", "Integration type (e.g. slack, gmail)")
    .option("--timeout <seconds>", "Timeout in seconds (default 300, max 900)", parseIntFlag)
    .option("--json", "Emit JSON")
    .action(async (type: string, opts: { timeout?: number; json?: boolean }) => {
        await integrateWait({ integrationType: type, timeoutSeconds: opts.timeout, json: opts.json })
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
        .option(...ENTRY_FILE_OPTION)
        .action(async (jobName?: string, opts?: { event?: string; eventFile?: string; entryFile?: string }) => {
            await run(jobName, opts?.event, opts?.eventFile, resolveProvider(), opts?.entryFile)
        })
}

program.commandsGroup("Improvements:")
program
    .command("apply")
    .description("Apply a suggested improvement patch locally (runs `git apply`)")
    .argument("[improvement-id]", "ID of the improvement to apply (prompts if omitted)")
    .action(async (improvementId?: string) => {
        await applyImprovement(improvementId)
    })
program
    .command("list")
    .description("List Terse resources")
    .addCommand(
        new Command("improvements").description("List pending improvements across all agents").action(async () => {
            await listImprovements()
        })
    )

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
    .option("--limit <n>", "Max runs to fetch (default 20, max 100)", parseIntFlag)
    .option("--page <n>", "Page number (1-indexed)", parseIntFlag)
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

    if (isCliError(error)) {
        emitCliError(error)
        process.exit(error.exitCode)
    }

    throw error
}

// Types

type JsonOpts = {
    json?: boolean
}

type EntryFileOpts = {
    entryFile?: string
}

type JsonEntryFileOpts = JsonOpts & EntryFileOpts
