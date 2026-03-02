#!/usr/bin/env node

import { Command } from "commander"
import { deploy } from "./deploy.js"
import { generate } from "./generate.js"
import { integrate } from "./integrate.js"
import { init } from "./init.js"
import { run } from "./run.js"
import { test } from "./test.js"

const program = new Command()

program
    .name("terse")
    .description("The Terse CLI — scaffold and manage Terse projects")
    .version("0.1.0")

program
    .command("init")
    .description("Scaffold a new Terse project")
    .argument("[project-name]", "Name for the project directory")
    .action(async (projectName?: string) => {
        await init(projectName)
    })

program
    .command("generate")
    .description("Generate TypeScript types for your connected integrations")
    .action(async () => {
        await generate()
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
    .action(async (jobName?: string, opts?: { event?: string }) => {
        await run(jobName, opts?.event)
    })

program
    .command("test")
    .description("Fetch sample events and run a job interactively")
    .argument("[job-name]", "Name of the job to test (auto-selects if only one exists)")
    .action(async (jobName?: string) => {
        await test(jobName)
    })

program
    .command("deploy")
    .description("Deploy a job to Terse")
    .argument("[job-name]", "Name of the job to deploy")
    .option("--all", "Deploy all jobs in the project")
    .action(async (jobName?: string, opts?: { all?: boolean }) => {
        await deploy(jobName, opts?.all)
    })

await program.parseAsync()
