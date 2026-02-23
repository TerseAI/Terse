#!/usr/bin/env node

import { Command } from "commander"
import { generate } from "./generate.js"
import { init } from "./init.js"
import { run } from "./run.js"

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
    .command("run")
    .description("Execute a job's onTrigger locally for testing")
    .argument("[job-name]", "Name of the job to run (auto-selects if only one exists)")
    .action(async (jobName?: string) => {
        await run(jobName)
    })

await program.parseAsync()
