import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"

import type { LanguageProvider } from "./providers/LanguageProvider.js"

/**
 * Verify the CWD is the root of a Terse project for the active language provider.
 * Exits with a clear error message if not.
 */
export function assertProjectRoot(provider: LanguageProvider, markers: { requiredFiles: string[]; description: string } = provider.projectMarkers): void {
    const cwd = process.cwd()
    const missingFiles = markers.requiredFiles.filter(relativePath => !fs.existsSync(path.join(cwd, relativePath)))

    if (missingFiles.length > 0) {
        console.error(chalk.red(`Error: Current directory is not a ${markers.description}. Missing: ${missingFiles.join(", ")}.`))
        process.exit(1)
    }
}
