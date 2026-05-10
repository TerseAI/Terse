#!/usr/bin/env node
// Test helper: scaffold a fresh Terse project, run integrate (GitHub + Slack),
// and deploy. The CLI steps remain interactive — this script just chains them
// so you don't retype the sequence.
//
// Usage:
//   pnpm run test:setup-job              # creates terse-test-<timestamp>/
//   pnpm run test:setup-job my-folder    # creates ./my-folder/

import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const folderArg = process.argv[2]
const folderName = folderArg ?? `terse-test-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}`
const targetDir = path.resolve(process.cwd(), folderName)

if (fs.existsSync(targetDir)) {
    console.error(`Directory already exists: ${targetDir}`)
    process.exit(1)
}

function run(command, args, cwd) {
    return new Promise((resolve, reject) => {
        console.log(`\n$ ${command} ${args.join(" ")}  (in ${cwd})`)
        const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env })
        child.on("error", reject)
        child.on("exit", code => {
            if (code === 0) resolve()
            else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`))
        })
    })
}

try {
    await run("terse", ["init", folderName], process.cwd())
    await run("terse", ["integrate"], targetDir)
    await run("terse", ["deploy"], targetDir)
    console.log(`\nDone. Test job set up in ${targetDir}`)
} catch (err) {
    console.error(`\n${err.message}`)
    process.exit(1)
}
