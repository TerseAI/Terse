#!/usr/bin/env node

import chalk from "chalk"
import { Command } from "commander"

import { CliError, emitCliError, isCliError, setErrorOutputJson } from "./cliError.js"
import { NonInteractiveOpts, collectKeyValue, parseIntFlag } from "./cliHelpers.js"
import { getCliVersion } from "./cliVersion.js"
import { attach } from "./commands/attach.js"
import { loginAndPersist, logout } from "./commands/auth.js"
import { authOrgList, authOrgSwitch } from "./commands/authOrg.js"
import { authStatus } from "./commands/authStatus.js"
import { completionHandler, completionInstall, completionUninstall } from "./commands/completion.js"
import { openDashboard } from "./commands/dashboard.js"
import { deploy } from "./commands/deploy.js"
import { openDocs } from "./commands/docs.js"
import { generate } from "./commands/generate.js"
import { history } from "./commands/history.js"
import { applyImprovement, listImprovements } from "./commands/improvements.js"
import { init } from "./commands/init.js"
import { install, update } from "./commands/install.js"
import { integrate, integrateConnect, integrateDescribe, integrateDisconnect, integrateList, integrateTool, integrateWait } from "./commands/integrate.js"
import { integrateConnections, integrateUse } from "./commands/integrateUse.js"
import { listen } from "./commands/listen.js"
import { memoryGet, memoryList, memoryPut, memoryRemove } from "./commands/memory.js"
import { replay } from "./commands/replay.js"
import { resume } from "./commands/resume.js"
import { run } from "./commands/run.js"
import { secretsAdd, secretsImport, secretsList, secretsRemove } from "./commands/secrets.js"
import { stateGet, stateList, stateRemove, stateReset } from "./commands/state.js"
import { targetClear, targetStatus, targetUse } from "./commands/target.js"
import { test, testList, testRun, testShow } from "./commands/test.js"
import { integrateToolRun } from "./commands/toolRun.js"
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

program.name("terse").description("The CLI for Terse, the AI workflow platform for coding agents").version(getCliVersion())
program.hook("preAction", (_thisCommand, actionCommand) => {
    syncJsonErrorOutput(actionCommand)
})

program.commandsGroup("Getting started:")
program
    .command("install")
    .description("Set up Terse on this machine: global CLI, agent skills, and login")
    .option(...NON_INTERACTIVE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ npx terse-cli install                   # first-time setup on a fresh machine
  $ terse install --non-interactive         # skip prompts (CI/agents); no settings edits, no login
`
    )
    .action(async (opts?: NonInteractiveOpts) => {
        await install(opts)
    })
program
    .command("update")
    .description("Update the Terse CLI and re-sync the Terse skills across your coding agents")
    .action(async () => {
        await update()
    })
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
  $ terse init myproj --non-interactive     # non-interactive; requires prior \`terse auth login\`
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
    .option("-v, --verbose", "Show job stream output", true)
    .option("--no-verbose", "Hide job stream output")
    .option("--fresh-state", "Reset the job's test state before running")
    .option(...ENTRY_FILE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse test                              # interactive picker
  $ terse test my-job                       # test a specific job
  $ terse test my-job --fresh-state         # reset test state first (e.g. to re-test dedupe)

Non-interactive subcommands (for AI agents and CI):
  $ terse test list --json                  # enumerate sample events with ids
  $ terse test show <id>                    # inspect a specific sample
  $ terse test run --id <id>                # run a cached sample by content hash
  $ terse test run --event-file sample.json # run a sample event from disk
`
    )
    .action(async (jobName?: string, opts?: EntryFileOpts & { verbose?: boolean; freshState?: boolean }) => {
        await test(jobName, opts?.verbose, resolveProvider(), opts?.entryFile, opts?.freshState)
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
    .option("--event <json>", "Inline trigger event fixture JSON")
    .option("--event-file <path>", "Path to a JSON file containing the trigger event fixture")
    .option("-v, --verbose", "Show job stream output", true)
    .option("--no-verbose", "Hide job stream output")
    .option("--fresh-state", "Reset the job's test state before running")
    .option(...ENTRY_FILE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse test list --json | jq -r '.events[0].id' | xargs -I{} terse test run --id {}
  $ terse test run --event-file fixture.json
  $ terse test run --id <id> --fresh-state
`
    )
    .action(async (jobName?: string, opts?: { id?: string; event?: string; eventFile?: string; verbose?: boolean; entryFile?: string; freshState?: boolean }) => {
        await testRun({
            jobName,
            id: opts?.id,
            eventJson: opts?.event,
            eventFile: opts?.eventFile,
            verbose: opts?.verbose,
            entryFile: opts?.entryFile,
            freshState: opts?.freshState
        })
    })

program
    .command("listen")
    .description("Stream live trigger events from a deployed Terse job to your local code (great for self-hosted webhook iteration)")
    .argument("[job-name]", "Name of the job to listen on (auto-selects if only one local job exists)")
    .option("-v, --verbose", "Show job stream output", true)
    .option("--no-verbose", "Hide job stream output")
    .option(...ENTRY_FILE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse listen                            # auto-selects if you have a single local job
  $ terse listen my-webhook-job             # listen for events on a specific job

Notes:
  - Each event the live backend dispatches to the deployed job is mirrored to this stream.
  - Production processing is unchanged — \`terse listen\` is a tap, not a redirect.
  - The job must already be deployed; if it isn't, the command exits with a clear error.
`
    )
    .action(async (jobName?: string, opts?: EntryFileOpts & { verbose?: boolean }) => {
        await listen(jobName, { verbose: opts?.verbose, entryFile: opts?.entryFile, provider: resolveProvider() })
    })

program
    .command("resume")
    .description("Resume an interrupted durable run from its journal in .terse/data")
    .requiredOption("--run-id <id>", "Terse run id of the run to resume")
    .option("-v, --verbose", "Show job stream output", true)
    .option("--no-verbose", "Hide job stream output")
    .addHelpText(
        "after",
        `
Examples:
  $ terse resume --run-id <terse-run-id>    # continue a paused or interrupted run

Notes:
  - Pending/running runs resume where they left off; a failed run is re-driven (its failure trimmed, completed steps replayed) under your current code.
  - The run's journal must be present in .terse/data (e.g. restored from a snapshot).
`
    )
    .action(async (opts: { runId: string; verbose?: boolean }) => {
        await resume(opts.runId, { verbose: opts.verbose })
    })

program
    .command("deploy")
    .description("Deploy all jobs to Terse (syncs with server — removed jobs are deleted)")
    .option(...ENTRY_FILE_OPTION)
    .action(async (opts?: EntryFileOpts) => {
        await deploy(resolveProvider(), opts?.entryFile)
    })

program
    .command("build")
    .description("Build the durable workflow bundle into .terse/wf")
    .action(async () => {
        await resolveProvider().prebuild()
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
  $ terse integrate tool slack --json                 # list an integration's tools
  $ terse integrate tool slack slack_send_message --json  # one tool's input/output schemas
  $ terse integrate tool run slack.listChannels           # invoke a tool ad hoc, no job required
  $ terse integrate connections slack --json              # enumerate a workspace's connections + IDs
  $ terse integrate use slack                              # pin which connection this project uses
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

const integrateToolCommand = integrateCommand
    .command("tool")
    .description("List an integration's tools, show one tool's schemas, or run a tool ad hoc")
    .argument("<type>", "Integration type (e.g. slack, snowflake)")
    .argument("[tool-name]", "Tool name (e.g. slack_send_message); omit to list every tool")
    .option("--json", "Emit JSON")
    .addHelpText(
        "after",
        `
Examples:
  $ terse integrate tool slack                             # list Slack's tools
  $ terse integrate tool slack --json
  $ terse integrate tool slack slack_send_message --json   # one tool's description and input/output schemas
  $ terse integrate tool run slack.listChannels            # invoke a tool without building a job
`
    )
    .action(async (type: string, toolName: string | undefined, opts: JsonOpts) => {
        await integrateTool({ integrationType: type, toolName, json: opts.json })
    })

integrateToolCommand
    .command("run")
    .description("Invoke a read-only toolbox tool ad hoc and print its JSON result — no job or deploy required")
    .argument("<tool>", "Tool to run, as attio_records or attio.records")
    .option("--params <json>", "Tool params as a JSON object; pass '-' (or pipe) to read from stdin")
    .option("--integration <id>", "Integration connection ID (only needed when several connections exist)")
    .addHelpText(
        "after",
        `
Examples:
  $ terse integrate tool run slack.listChannels
  $ terse integrate tool run attio.records --params '{"request":{"action":"query","objectSlug":"deals","limit":5}}'
  $ echo '{"request":{"action":"search","objectSlug":"companies","query":"acme"}}' | terse integrate tool run attio_records
  $ terse integrate tool run linear.searchTicket --integration cm123 --params '{"query":"TER-658"}'

Only read-only tools can be run ad hoc; write tools (and approval-gated tools) run inside jobs.
The result is printed to stdout as raw JSON; errors go to stderr with a nonzero exit code.
Params are the tool's wire shape — see \`terse integrate tool <integration> <tool-name> --json\` for the input schema.
`
    )
    .action(async (tool: string, opts: { params?: string; integration?: string }) => {
        await integrateToolRun({ toolName: tool, params: opts.params, integrationId: opts.integration })
    })

integrateCommand
    .command("connections")
    .description("List an integration's connections with their IDs and which one this project pins")
    .argument("<type>", "Integration type (e.g. slack)")
    .option("--json", "Emit JSON")
    .addHelpText(
        "after",
        `
Examples:
  $ terse integrate connections slack
  $ terse integrate connections slack --json           # {id, name, pinned} per connection

Non-interactive counterpart to the \`terse integrate use\` picker: list here, then pin with \`terse integrate use <type> <connection-id>\`.
`
    )
    .action(async (type: string, opts: JsonOpts) => {
        await integrateConnections({ integrationType: type, json: opts.json })
    })

integrateCommand
    .command("use")
    .description("Pin which connection this project generates against, then regenerate terse.generated.ts and terse.generated/")
    .argument("<type>", "Integration type (e.g. slack)")
    .argument("[connection-id]", "Connection ID; omit to pick interactively (or auto-pin a single connection)")
    .option("--clear", "Remove this integration's pin and regenerate")
    .addHelpText(
        "after",
        `
Examples:
  $ terse integrate use slack                          # pick from the workspace's Slack connections
  $ terse integrate use slack cmr3l8b3d0003bpq4rpifevze
  $ terse integrate use slack --clear                  # back to the default (oldest) connection

Non-interactive (agents/CI): the picker is disabled without a TTY — list IDs with \`terse integrate connections <type> --json\` and pass one explicitly.
The pin is stored in terse.config.json and also drives \`terse integrate tool run\` resolution in this project.
`
    )
    .action(async (type: string, connectionId: string | undefined, opts: { clear?: boolean }) => {
        await integrateUse({ integrationType: type, connectionId, clear: opts.clear }, resolveProvider())
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

const secretsCommand = program
    .command("secrets")
    .description("Manage managed project secrets")
    .addHelpText(
        "after",
        `
Examples:
  $ terse secrets list --json
  $ terse secrets add OPENAI_API_KEY
  $ printf '%s' "$OPENAI_API_KEY" | terse secrets add OPENAI_API_KEY --value-stdin
  $ terse secrets import .env --overwrite
  $ terse secrets remove OPENAI_API_KEY --yes
`
    )

secretsCommand
    .command("list")
    .description("List project secret names")
    .option("--json", "Emit JSON")
    .action(async (opts: JsonOpts) => {
        await secretsList({ json: opts.json })
    })

secretsCommand
    .command("add")
    .description("Add or update a project secret")
    .argument("<NAME>", "Secret environment variable name")
    .option("--value-stdin", "Read the secret value from stdin")
    .option("--skip-local-sync", "Skip syncing the secret to the local environment", false)
    .action(async (name: string, opts: { valueStdin?: boolean; skipLocalSync?: boolean }) => {
        await secretsAdd(name, { valueStdin: opts.valueStdin, skipLocalSync: opts.skipLocalSync })
    })

secretsCommand
    .command("remove")
    .description("Remove a project secret")
    .argument("<NAME>", "Secret environment variable name")
    .option("--yes", "Confirm removal")
    .option("--skip-local-sync", "Skip syncing the secret to the local environment")
    .action(async (name: string, opts: { yes?: boolean; skipLocalSync?: boolean }) => {
        await secretsRemove(name, { yes: opts.yes, skipLocalSync: opts.skipLocalSync })
    })

secretsCommand
    .command("import")
    .description("Import project secrets from a .env file")
    .argument("<file>", ".env-format file")
    .option("--overwrite", "Update existing server-side secrets")
    .action(async (file: string, opts: { overwrite?: boolean }) => {
        await secretsImport(file, { overwrite: opts.overwrite })
    })

const memoryCommand = program
    .command("memory")
    .description("Inspect and manage a job's persistent agent memory")
    .addHelpText(
        "after",
        `
Examples:
  $ terse memory list --job my-job
  $ terse memory get notes.md --job my-job --out ./notes.md
  $ printf '%s' "new contents" | terse memory put notes.md --job my-job
  $ terse memory put notes.md --job my-job --file ./notes.md
  $ terse memory rm notes.md --job my-job --yes
`
    )

memoryCommand
    .command("list")
    .description("List memory files for a job")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` memory instead of production")
    .option("--json", "Emit JSON")
    .option(...ENTRY_FILE_OPTION)
    .action(async (opts: JsonEntryFileOpts & { job?: string; test?: boolean }) => {
        await memoryList({ job: opts.job, test: opts.test, json: opts.json, entryFile: opts.entryFile })
    })

memoryCommand
    .command("get")
    .description("Read a memory file (to stdout, or to a local file with --out)")
    .argument("<path>", "Memory file path (relative to the job's memory root)")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` memory instead of production")
    .option("--out <file>", "Write the contents to a local file instead of stdout")
    .option(...ENTRY_FILE_OPTION)
    .action(async (path: string, opts: EntryFileOpts & { job?: string; test?: boolean; out?: string }) => {
        await memoryGet(path, { job: opts.job, test: opts.test, out: opts.out, entryFile: opts.entryFile })
    })

memoryCommand
    .command("put")
    .description("Create or replace a memory file (from --file or stdin)")
    .argument("<path>", "Memory file path (relative to the job's memory root)")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` memory instead of production")
    .option("--file <path>", "Local file to upload (otherwise reads stdin)")
    .option(...ENTRY_FILE_OPTION)
    .action(async (path: string, opts: EntryFileOpts & { job?: string; test?: boolean; file?: string }) => {
        await memoryPut(path, { job: opts.job, test: opts.test, file: opts.file, entryFile: opts.entryFile })
    })

memoryCommand
    .command("rm")
    .description("Delete a memory file")
    .argument("<path>", "Memory file path (relative to the job's memory root)")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` memory instead of production")
    .option("--yes", "Confirm deletion")
    .option(...ENTRY_FILE_OPTION)
    .action(async (path: string, opts: EntryFileOpts & { job?: string; test?: boolean; yes?: boolean }) => {
        await memoryRemove(path, { job: opts.job, test: opts.test, yes: opts.yes, entryFile: opts.entryFile })
    })

const stateCommand = program
    .command("state")
    .description("Inspect and manage a job's typed persistent state")
    .addHelpText(
        "after",
        `
State is written by \`state.set(...)\` in a job's filter/onTrigger handlers. Deployed runs and
\`terse test\` runs use separate state: commands default to the deployed state (read-only) and
target the test state with --test.

Examples:
  $ terse state list --job my-job
  $ terse state list --job my-job --test
  $ terse state get lastProcessedId --job my-job
  $ terse state rm lastProcessedId --job my-job --test --yes
  $ terse state reset --job my-job --test --yes
`
    )

stateCommand
    .command("list")
    .description("List state keys for a job")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` state instead of deployed state")
    .option("--json", "Emit JSON")
    .option(...ENTRY_FILE_OPTION)
    .action(async (opts: JsonEntryFileOpts & { job?: string; test?: boolean }) => {
        await stateList({ job: opts.job, test: opts.test, json: opts.json, entryFile: opts.entryFile })
    })

stateCommand
    .command("get")
    .description("Print a state value as JSON")
    .argument("<key>", "State key (as declared in the job's `states`)")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` state instead of deployed state")
    .option(...ENTRY_FILE_OPTION)
    .action(async (key: string, opts: EntryFileOpts & { job?: string; test?: boolean }) => {
        await stateGet(key, { job: opts.job, test: opts.test, entryFile: opts.entryFile })
    })

stateCommand
    .command("rm")
    .description("Delete one test state key (deployed state is read-only)")
    .argument("<key>", "State key (as declared in the job's `states`)")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` state (required)")
    .option("--yes", "Confirm deletion")
    .option(...ENTRY_FILE_OPTION)
    .action(async (key: string, opts: EntryFileOpts & { job?: string; test?: boolean; yes?: boolean }) => {
        await stateRemove(key, { job: opts.job, test: opts.test, yes: opts.yes, entryFile: opts.entryFile })
    })

stateCommand
    .command("reset")
    .description("Delete all test state for a job (deployed state is read-only)")
    .option("--job <name>", "Job name (auto-selects if only one exists)")
    .option("--test", "Target the isolated `terse test` state (required)")
    .option("--yes", "Confirm deletion")
    .option(...ENTRY_FILE_OPTION)
    .action(async (opts: EntryFileOpts & { job?: string; test?: boolean; yes?: boolean }) => {
        await stateReset({ job: opts.job, test: opts.test, yes: opts.yes, entryFile: opts.entryFile })
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
        .option("--event <json>", "Trigger event fixture JSON string")
        .option("--event-file <path>", "Path to a JSON file containing the trigger event fixture")
        .option("-v, --verbose", "Show job stream output (use --no-verbose to silence)", true)
        .option("--no-verbose", "Hide job stream output")
        .option(...ENTRY_FILE_OPTION)
        .action(async (jobName?: string, opts?: { event?: string; eventFile?: string; verbose?: boolean; entryFile?: string }) => {
            await run(jobName, opts?.event, opts?.eventFile, resolveProvider(), opts?.entryFile, opts?.verbose)
        })
}

program.commandsGroup("Improvements:")
program
    .command("apply")
    .description("Apply a suggested improvement patch locally (runs `git apply`)")
    .argument("[improvement-id]", "ID of the improvement to apply (prompts if omitted)")
    .option(...NON_INTERACTIVE_OPTION)
    .addHelpText(
        "after",
        `
Examples:
  $ terse apply                                   # interactive picker
  $ terse apply <improvement-id>                  # apply a specific improvement
  $ terse apply <improvement-id> --non-interactive  # fail fast on prompts (CI/agents)
`
    )
    .action(async (improvementId?: string, opts?: NonInteractiveOpts) => {
        await applyImprovement(improvementId, opts)
    })
program
    .command("list")
    .description("List Terse resources")
    .addCommand(
        new Command("improvements").description("List pending improvements across all jobs").action(async () => {
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
    .option("--include-test", "Include runs from `terse test` (hidden by default)")
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
                includeTest?: boolean
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
const authCommand = program.command("auth").description("Manage authentication and active organization")

authCommand
    .command("login")
    .description("Log in to Terse")
    .action(async () => {
        const result = await loginAndPersist()
        if (!result) process.exit(1)
    })

authCommand
    .command("logout")
    .description("Log out of Terse")
    .action(() => {
        const removed = logout()
        if (removed) {
            console.log(chalk.green("  Logged out."))
        } else {
            console.log(chalk.dim("  Not logged in."))
        }
    })

authCommand
    .command("status")
    .description("Show the current user and active organization")
    .action(async () => {
        await authStatus()
    })

const authOrgCommand = authCommand.command("org").description("List or switch the active organization")

authOrgCommand
    .command("list")
    .description("List organizations you belong to")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
        await authOrgList(opts)
    })

authOrgCommand
    .command("switch [org-id]")
    .description("Switch the active organization. Pass an org id to skip the picker.")
    .action(async (orgId: string | undefined) => {
        await authOrgSwitch(orgId)
    })

program.commandsGroup("Environment:")
const targetCommand = program
    .command("target")
    .description("Show or change which Terse backend the CLI is pointing at (cloud, local, or custom)")
    .addHelpText(
        "after",
        `
Examples:
  $ terse target                                              # show current backend / frontend URLs
  $ terse target use local                                    # point at http://localhost:{3001,5173}
  $ terse target use production                               # point back at api.useterse.ai
  $ terse target use --backend-url http://my-host:3001 --frontend-url http://my-host:5173
  $ terse target clear                                        # remove the managed block from your shell rc

URLs are written to your shell rc (~/.zshrc or ~/.bashrc) as TERSE_BACKEND_URL / TERSE_FRONTEND_URL.
After running \`use\` or \`clear\`, open a new shell or \`source\` your rc file to pick up the change.
`
    )
    .action(() => {
        targetStatus()
    })

targetCommand
    .command("status")
    .description("Print the current backend / frontend URLs (from TERSE_BACKEND_URL / TERSE_FRONTEND_URL)")
    .action(() => {
        targetStatus()
    })

targetCommand
    .command("use [preset]")
    .description("Point the CLI at `local`, `production`, or explicit URLs (writes exports to your shell rc)")
    .option("--backend-url <url>", "Backend URL to use (TERSE_BACKEND_URL)")
    .option("--frontend-url <url>", "Frontend URL to use (TERSE_FRONTEND_URL)")
    .option("-y, --yes", "Skip the confirmation prompt before editing your shell rc")
    .action(async (preset: string | undefined, opts: { backendUrl?: string; frontendUrl?: string; yes?: boolean }) => {
        await targetUse(preset, opts)
    })

targetCommand
    .command("clear")
    .description("Remove the terse-managed exports from your shell rc")
    .option("-y, --yes", "Skip the confirmation prompt")
    .action(async (opts: { yes?: boolean }) => {
        await targetClear(opts)
    })

program.commandsGroup("Getting help:")
program
    .command("docs")
    .description("Open Terse documentation in your browser")
    .action(() => {
        openDocs()
    })

const completionCommand = program.command("completion").description("Manage shell tab completion for terse")

completionCommand
    .command("install")
    .description("Install tab completion into your shell")
    .action(() => completionInstall())

completionCommand
    .command("uninstall")
    .description("Remove tab completion from your shell")
    .action(() => completionUninstall())

program.helpCommand(true)

if (process.argv[2] === "completion-server") {
    completionHandler(program)
    process.exit(0)
}

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
