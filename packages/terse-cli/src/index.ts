#!/usr/bin/env node

import { Command } from "commander"

import { loginAndWriteEnv } from "./auth.js"
import { deploy } from "./deploy.js"
import { generate } from "./generate.js"
import { init } from "./init.js"
import { integrate } from "./integrate.js"
import { resolveProvider } from "./providers/resolveProvider.js"
import { run } from "./run.js"
import { test } from "./test.js"

const program = new Command()

program.name("terse").description("The Terse CLI — scaffold and manage Terse projects").version("0.1.0")

program
    .command("init")
    .description("Scaffold a new Terse project")
    .argument("[project-name]", "Name for the project directory")
    .option("-l, --language <language>", "Project language (ts|typescript|py|python)", "ts")
    .action(async (projectName?: string, options?: { language?: string }) => {
        const provider = resolveProvider({ command: "init", language: options?.language })
        await init(projectName, provider)
    })

program
    .command("login")
    .description("Authenticate with Terse via your browser")
    .action(async () => {
        const success = await loginAndWriteEnv(process.cwd())
        if (!success) process.exit(1)
    })

program
    .command("generate")
    .description("Generate TypeScript types for your connected integrations")
    .action(async () => {
        await generate(resolveProvider())
    })

program
    .command("integrate")
    .description("Open the integrations page in the Terse Web UI")
    .action(async () => {
        await integrate()
    })

program
    .command("run")
    .description("Execute a job's onTrigger with a serialized event JSON")
    .argument("[job-name]", "Name of the job to run (auto-selects if only one exists)")
    .option("--event <json>", "Serialized event JSON string")
    .option("--event-file <path>", "Path to a JSON file containing the serialized event")
    .action(async (jobName?: string, opts?: { event?: string; eventFile?: string }) => {
        await run(jobName, opts?.event, opts?.eventFile, resolveProvider())
    })

program
    .command("test")
    .description("Fetch sample events and run a job interactively")
    .argument("[job-name]", "Name of the job to test (auto-selects if only one exists)")
    .option("-v, --verbose", "Show agent stream output", true)
    .action(async (jobName?: string, opts?: { verbose?: boolean }) => {
        await test(jobName, opts?.verbose, resolveProvider())
    })

program
    .command("deploy")
    .description("Deploy all jobs to Terse (syncs with server — removed jobs are deleted)")
    .action(async () => {
        await deploy(resolveProvider())
    })

await program.parseAsync()
