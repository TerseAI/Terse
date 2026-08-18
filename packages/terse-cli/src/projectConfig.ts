import fs from "node:fs"
import path from "node:path"
import {
    ApiRoutes,
    buildRoute,
    projectEnsureCredentialsResponseSchema,
    projectRotateApiKeyResponseSchema,
    projectRotateSigningSecretResponseSchema,
    sdkCreateProjectResponseBodySchema,
    terseProjectConfigSchema
} from "terse-types"
import type { ProjectEnsureCredentialsResponse, TerseProjectConfig } from "terse-types"

import { fetchWithAuth } from "./api.js"
import { CliError } from "./cliError.js"

export const PROJECT_CONFIG_FILENAME = "terse.config.json"

function projectConfigPath(cwd: string = process.cwd()): string {
    return path.join(cwd, PROJECT_CONFIG_FILENAME)
}

export function readProjectConfig(cwd: string = process.cwd()): TerseProjectConfig | null {
    const filePath = projectConfigPath(cwd)
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath, "utf8")
    let parsedJson: unknown
    try {
        parsedJson = JSON.parse(raw)
    } catch (error) {
        throw new CliError("project_config_malformed", `${PROJECT_CONFIG_FILENAME} is malformed.`, {
            detail: error instanceof Error ? error.message : String(error)
        })
    }

    const parsed = terseProjectConfigSchema.safeParse(parsedJson)
    if (!parsed.success) {
        throw new CliError("project_config_malformed", `${PROJECT_CONFIG_FILENAME} is malformed.`, {
            detail: parsed.error.issues.map(issue => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n")
        })
    }

    return parsed.data
}

export function readProjectConfigOrBail(cwd: string = process.cwd()): TerseProjectConfig {
    const config = readProjectConfig(cwd)
    if (config) return config

    throw new CliError("project_not_attached", `No ${PROJECT_CONFIG_FILENAME} found in ${cwd}.`, {
        detail: `This project isn't linked to a Terse project yet.\n\nFor a new project, run \`terse init\`.\nFor an existing repo, run \`terse attach\`.`
    })
}

export function writeProjectConfig(cwd: string, config: TerseProjectConfig): void {
    const filePath = projectConfigPath(cwd)
    const serialized = JSON.stringify(config, null, 2) + "\n"
    fs.writeFileSync(filePath, serialized)
}

export async function rotateRemoteProjectApiKey(apiKey: string, projectId: string): Promise<string> {
    const response = await fetchWithAuth(buildRoute(ApiRoutes.PROJECTS.ROTATE_API_KEY, { id: projectId }), apiKey, {}, "POST")
    return projectRotateApiKeyResponseSchema.parse(response).projectApiKey
}

export async function rotateRemoteProjectSigningSecret(apiKey: string, projectId: string): Promise<string> {
    const response = await fetchWithAuth(buildRoute(ApiRoutes.PROJECTS.ROTATE_SIGNING_SECRET, { id: projectId }), apiKey, {}, "POST")
    return projectRotateSigningSecretResponseSchema.parse(response).signingSecret
}

export async function ensureRemoteProjectCredentials(apiKey: string, projectId: string): Promise<ProjectEnsureCredentialsResponse> {
    const response = await fetchWithAuth(buildRoute(ApiRoutes.PROJECTS.ENSURE_CREDENTIALS, { id: projectId }), apiKey, {}, "POST")
    return projectEnsureCredentialsResponseSchema.parse(response)
}

export async function createRemoteProject(apiKey: string, name: string, selfHosted?: boolean): Promise<{ config: TerseProjectConfig; signingSecret?: string; projectApiKey?: string }> {
    const response = await fetchWithAuth(ApiRoutes.SDK.CREATE_PROJECT, apiKey, { name, selfHosted }, "POST")
    const parsed = sdkCreateProjectResponseBodySchema.parse(response)
    return { config: { projectId: parsed.projectId, name: parsed.name }, signingSecret: parsed.signingSecret, projectApiKey: parsed.projectApiKey }
}
