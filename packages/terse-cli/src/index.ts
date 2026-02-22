#!/usr/bin/env node

import { Command } from "commander"
import { init } from "./init.js"

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

await program.parseAsync()
