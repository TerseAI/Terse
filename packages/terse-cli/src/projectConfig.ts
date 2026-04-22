import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import { ApiRoutes, sdkCreateProjectResponseBodySchema, terseProjectConfigSchema } from "terse-types"
import type { TerseProjectConfig } from "terse-types"

import { fetchWithAuth } from "./api.js"

export const PROJECT_CONFIG_FILENAME = "terse.config.json"

export function projectConfigPath(cwd: string = process.cwd()): string {
    return path.join(cwd, PROJECT_CONFIG_FILENAME)
}

export function readProjectConfig(cwd: string = process.cwd()): TerseProjectConfig | null {
    const filePath = projectConfigPath(cwd)
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath, "utf8")
    const parsed = terseProjectConfigSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
        console.error(chalk.red(`Error: ${PROJECT_CONFIG_FILENAME} is malformed.`))
        console.error(chalk.dim(parsed.error.issues.map(issue => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n")))
        process.exit(1)
    }

    return parsed.data
}

export function readProjectConfigOrBail(cwd: string = process.cwd()): TerseProjectConfig {
    const config = readProjectConfig(cwd)
    if (config) return config

    console.error(chalk.red(`\n  Error: No ${PROJECT_CONFIG_FILENAME} found in ${cwd}.`))
    console.error(chalk.dim(`  This project isn't linked to a Terse project yet.\n`))
    console.error(`  For a new project, run ${chalk.cyan("terse init")}.`)
    console.error(`  For an existing repo, run ${chalk.cyan("terse attach")}.\n`)
    process.exit(1)
}

export function writeProjectConfig(cwd: string, config: TerseProjectConfig): void {
    const filePath = projectConfigPath(cwd)
    const serialized = JSON.stringify(config, null, 2) + "\n"
    fs.writeFileSync(filePath, serialized)
}

export async function createRemoteProject(apiKey: string, name: string): Promise<TerseProjectConfig> {
    const response = await fetchWithAuth(ApiRoutes.SDK.CREATE_PROJECT, apiKey, { name }, "POST")
    const parsed = sdkCreateProjectResponseBodySchema.parse(response)
    return { projectId: parsed.projectId, name: parsed.name }
}
