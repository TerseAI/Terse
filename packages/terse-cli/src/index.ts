#!/usr/bin/env node

import { init } from "./init.js"

const args = process.argv.slice(2)
const command = args[0]

switch (command) {
    case "init": {
        const projectName = args[1]
        await init(projectName)
        break
    }
    default:
        console.log(`Usage: terse <command>

Commands:
  init [project-name]   Scaffold a new Terse project

Examples:
  terse init my-project   Create a new project in ./my-project
  terse init              Create a new project in the current directory`)
        process.exit(command ? 1 : 0)
}
