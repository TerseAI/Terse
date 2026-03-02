import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"

/**
 * Verify the CWD is the root of a Terse project (has package.json + src/index.ts).
 * Exits with a clear error message if not.
 */
export function assertProjectRoot(): void {
    const cwd = process.cwd()

    if (!fs.existsSync(path.join(cwd, "package.json"))) {
        console.error(chalk.red("Error: No package.json found. Run this command from the root of your Terse project."))
        process.exit(1)
    }

    if (!fs.existsSync(path.join(cwd, "src", "index.ts"))) {
        console.error(chalk.red("Error: No src/index.ts found. Run this command from the root of your Terse project."))
        process.exit(1)
    }
}
