import fs from "node:fs"

// Split out of durableRuntime so callers can read the pin without pulling in @workflow/core.
export function expectedWorkflowCoreVersion(): string {
    const cliPackageJson = new URL("../../../package.json", import.meta.url)
    return JSON.parse(fs.readFileSync(cliPackageJson, "utf8")).dependencies["@workflow/core"]
}
