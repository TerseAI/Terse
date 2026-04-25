import fs from "node:fs"
import path from "node:path"

import { CliError } from "./cliError.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"

/**
 * Verify the CWD is the root of a Terse project for the active language provider.
 * Throws a CliError with guidance if not.
 */
export function assertProjectRoot(provider: LanguageProvider, markers: { requiredFiles: string[]; description: string } = provider.projectMarkers): void {
    const cwd = process.cwd()
    const missingFiles = markers.requiredFiles.filter(relativePath => !fs.existsSync(path.join(cwd, relativePath)))

    if (missingFiles.length > 0) {
        throw new CliError("not_project_root", `Current directory is not a ${markers.description}.`, {
            detail: `Missing: ${missingFiles.join(", ")}.`
        })
    }
}
