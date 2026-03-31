import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

/**
 * Verify the CWD is the root of a Terse project for the active language provider.
 * Exits with a clear error message if not.
 */
export function assertProjectRoot(provider: LanguageProvider): void {
    const cwd = process.cwd()
    const missingFiles = provider.projectMarkers.requiredFiles.filter(relativePath =>
        !fs.existsSync(path.join(cwd, relativePath))
    )

    if (missingFiles.length > 0) {
        console.error(
            chalk.red(
                `Error: Current directory is not a ${provider.projectMarkers.description}. Missing: ${missingFiles.join(", ")}.`
            )
        )
        process.exit(1)
    }
}
