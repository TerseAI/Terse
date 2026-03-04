/**
 * Pure codegen function: integration data → TypeScript source text.
 * No I/O — all side effects live in generate.ts.
 */

import type { GithubIntegration } from "./shared/Integrations.js"

// ── Public Types ──────────────────────────────────────────────────────

export interface GitHubRepo { id: number; name: string; owner: string; fullName?: string }
export interface GitHubInstanceData { integration: GithubIntegration; repositories: GitHubRepo[] }

export interface IntegrationInstanceData { id: string; displayName: string }

// Resource data types (match API responses)
export interface SlackChannelData { id: string; name: string }
export interface LinearTeamData { id: string; name: string; key: string }
export interface NotionResourceData { id: string; title: string; type: string }
export interface JiraProjectData { id: string; key: string; name: string }
export interface ConfluencePageData { id: string; title: string; spaceId: string; spaceName: string }
export interface PosthogProjectData { id: string; name: string }
export interface DatadogIndexData { name: string }
export interface LaunchDarklyProjectData { key: string; name: string }
export interface AttioObjectData { api_slug: string; singular_noun: string }

// Instance data types with resources
export interface SlackInstanceData extends IntegrationInstanceData { channels: SlackChannelData[] }
export interface LinearInstanceData extends IntegrationInstanceData { teams: LinearTeamData[] }
export interface NotionInstanceData extends IntegrationInstanceData { databases: NotionResourceData[]; pages: NotionResourceData[] }
export interface AtlassianInstanceData extends IntegrationInstanceData { jiraProjects: JiraProjectData[]; confluencePages: ConfluencePageData[] }
export interface PosthogInstanceData extends IntegrationInstanceData { projects: PosthogProjectData[] }
export interface DatadogInstanceData extends IntegrationInstanceData { indexes: DatadogIndexData[] }
export interface LaunchDarklyInstanceData extends IntegrationInstanceData { projects: LaunchDarklyProjectData[] }
export interface AttioInstanceData extends IntegrationInstanceData { objects: AttioObjectData[] }

export interface ToolDefinition {
    name: string
    displayName: string
    description: string
    integration: string
    isReadOnly: boolean
    parameters: JsonSchema
}

export interface JsonSchema {
    type?: string
    properties?: Record<string, JsonSchema>
    required?: string[]
    items?: JsonSchema
    enum?: (string | number | boolean)[]
    anyOf?: JsonSchema[]
    description?: string
    [key: string]: unknown
}

export interface CodegenInput {
    github: GitHubInstanceData[]
    slack: SlackInstanceData[]
    gmail: IntegrationInstanceData[]
    figma: IntegrationInstanceData[]
    linear: LinearInstanceData[]
    atlassian: AtlassianInstanceData[]
    notion: NotionInstanceData[]
    posthog: PosthogInstanceData[]
    datadog: DatadogInstanceData[]
    launchdarkly: LaunchDarklyInstanceData[]
    workos: IntegrationInstanceData[]
    attio: AttioInstanceData[]
    tools: ToolDefinition[]
}

// ── Internal Types ────────────────────────────────────────────────────

type SectionResult = { code: string; imports: Set<string> }
const EMPTY_SECTION: SectionResult = { code: "", imports: new Set() }

interface ResourceFieldMapping {
    classField: string
    type: string
    sourceField: string
}

// ── Helpers ───────────────────────────────────────────────────────────

function toPascalCase(s: string): string {
    return s
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join("")
}

function sectionHeader(name: string): string {
    const dashes = "─".repeat(Math.max(1, 58 - name.length))
    return `// ── ${name} ${dashes}`
}

function escapeString(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function suffix(instances: { displayName: string }[], i: number): string {
    return instances.length > 1 ? toPascalCase(instances[i].displayName || `Instance${i + 1}`) : ""
}

function generateInstanceLookup(
    parts: string[],
    prefix: string,
    instances: { id: string; name: string }[]
): { typeRef: string; varName: string; enumName: string; names: string[] } {
    const enumName = `${prefix}Instance`
    const varName = `__${prefix.charAt(0).toLowerCase()}${prefix.slice(1)}InstanceIds`
    const typeName = `${prefix}InstanceName`
    const names: string[] = []
    const usedNames = new Set<string>()
    for (const inst of instances) {
        let name = toPascalCase(inst.name || "Instance")
        if (!name) name = "Instance"
        while (usedNames.has(name)) name += "_"
        usedNames.add(name)
        names.push(name)
    }

    parts.push(`export const ${enumName} = {`)
    for (const name of names) {
        parts.push(`    ${name}: "${name}",`)
    }
    parts.push("} as const")
    parts.push(`export type ${typeName} = typeof ${enumName}[keyof typeof ${enumName}]`)
    parts.push(`const ${varName}: Record<${typeName}, string> = {`)
    for (let i = 0; i < instances.length; i++) {
        parts.push(`    ${names[i]}: "${escapeString(instances[i].id)}",`)
    }
    parts.push("}")
    parts.push("")

    return { typeRef: typeName, varName, enumName, names }
}

/** Map a tool's integration key back to the IntegrationType enum value used by ConfigInstance. */
function toolIntegrationToIntegrationType(toolIntegration: string): string {
    switch (toolIntegration) {
        case "jira":
        case "confluence":
            return "atlassian"
        default:
            return toolIntegration
    }
}

function generateResourceClass(
    className: string,
    fields: ResourceFieldMapping[],
    staticNameField: string,
    items: Record<string, any>[]
): string {
    const lines: string[] = []
    lines.push(`export class ${className} {`)
    const ctorParams = fields.map(f => `public readonly ${f.classField}: ${f.type}`).join(", ")
    lines.push(`    constructor(${ctorParams}) {}`)

    if (items.length > 0) {
        lines.push("")
        const usedNames = new Set<string>()
        for (const item of items) {
            let name = toPascalCase(String(item[staticNameField] || "Unknown"))
            if (!name || /^\d/.test(name)) name = `_${name}`
            while (usedNames.has(name)) name += "_"
            usedNames.add(name)

            const args = fields.map(f => {
                const val = item[f.sourceField]
                if (typeof val === "number") return String(val)
                return `"${escapeString(String(val ?? ""))}"`
            }).join(", ")

            lines.push(`    static ${name} = new ${className}(${args})`)
        }
    }

    lines.push("}")
    return lines.join("\n")
}

// ── GitHub ────────────────────────────────────────────────────────────

function generateGitHubSection(instances: GitHubInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["GitHubConfig"])
    const parts: string[] = [sectionHeader("GitHub"), ""]

    const multi = instances.length > 1
    const repoTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi
            ? toPascalCase(inst.integration.account_name || `Instance${i + 1}`)
            : ""
        const ownerClass = `GithubOwner${sfx}`
        const repoClass = `Repository${sfx}`
        repoTypes.push(repoClass)

        const toStaticName = (raw: string, fallback: string): string => {
            let name = toPascalCase(raw || fallback)
            if (!name) name = fallback
            if (/^\d/.test(name)) name = `_${name}`
            return name
        }

        const repositoriesWithFullName = inst.repositories.map(repo => {
            const owner = repo.owner || "UnknownOwner"
            const fullName = repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name
            return { ...repo, owner, fullName }
        })

        const ownerEntries = new Map<string, { staticName: string; repos: typeof repositoriesWithFullName }>()
        const usedOwnerNames = new Set<string>()
        for (const repo of repositoriesWithFullName) {
            if (!ownerEntries.has(repo.owner)) {
                let ownerStaticName = toStaticName(repo.owner, "UnknownOwner")
                while (usedOwnerNames.has(ownerStaticName)) ownerStaticName += "_"
                usedOwnerNames.add(ownerStaticName)
                ownerEntries.set(repo.owner, { staticName: ownerStaticName, repos: [] as any })
            }
            ownerEntries.get(repo.owner)!.repos.push(repo as any)
        }

        parts.push(`export class ${ownerClass} {`)
        parts.push(`    constructor(public readonly name: string) {}`)
        if (ownerEntries.size > 0) {
            parts.push("")
            for (const [owner, data] of ownerEntries) {
                parts.push(`    static ${data.staticName} = new ${ownerClass}("${escapeString(owner)}")`)
            }
        }
        parts.push("}")
        parts.push("")

        parts.push(`export class ${repoClass} {`)
        parts.push(`    constructor(`)
        parts.push(`        public readonly repositoryId: number,`)
        parts.push(`        public readonly name: string,`)
        parts.push(`        public readonly owner: ${ownerClass},`)
        parts.push(`        public readonly fullName: string`)
        parts.push(`    ) {}`)

        if (ownerEntries.size > 0) {
            parts.push("")
            for (const [owner, data] of ownerEntries) {
                const usedRepoNames = new Set<string>()
                parts.push(`    static ${data.staticName} = {`)
                for (const repo of data.repos) {
                    let repoStaticName = toStaticName(repo.name, "Repository")
                    while (usedRepoNames.has(repoStaticName)) repoStaticName += "_"
                    usedRepoNames.add(repoStaticName)
                    parts.push(
                        `        ${repoStaticName}: new ${repoClass}(${repo.id}, "${escapeString(repo.name)}", ${ownerClass}.${data.staticName}, "${escapeString(repo.fullName)}"),`
                    )
                }
                parts.push("    } as const")
            }
        }

        parts.push("}")
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Github",
            instances.map(inst => ({ id: inst.integration.id, name: inst.integration.account_name || "" })))
        const repoUnion = repoTypes.join(" | ")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function GithubTrigger(instance: ${typeRef}, repositories: (${repoUnion})[]): GitHubConfig {`)
        parts.push(`    return new GitHubConfig(${varName}[instance], repositories.map(r => r.repositoryId))`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function GithubSkill(instance: ${typeRef}, repositories: (${repoUnion})[]): GitHubConfig {`)
        parts.push(`    return new GitHubConfig(${varName}[instance], repositories.map(r => r.repositoryId))`)
        parts.push("}")
        parts.push("")
    } else {
        const repoClass = repoTypes[0]
        const id = instances[0].integration.id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function GithubTrigger(repositories: ${repoClass}[]): GitHubConfig {`)
        parts.push(`    return new GitHubConfig("${id}", repositories.map(r => r.repositoryId))`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function GithubSkill(repositories: ${repoClass}[]): GitHubConfig {`)
        parts.push(`    return new GitHubConfig("${id}", repositories.map(r => r.repositoryId))`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Gmail ─────────────────────────────────────────────────────────────

function generateGmailSection(instances: IntegrationInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["GmailConfig", "GmailOutputConfig", "GmailDraftOutputConfig"])
    const parts: string[] = [sectionHeader("Gmail"), ""]

    const multi = instances.length > 1

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Gmail",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function GmailTrigger(instance: ${typeRef}): GmailConfig {`)
        parts.push(`    return new GmailConfig(${varName}[instance])`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function GmailSkill(instance: ${typeRef}): GmailOutputConfig {`)
        parts.push(`    return new GmailOutputConfig(${varName}[instance])`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` — creates draft emails */`)
        parts.push(`export function GmailDraftSkill(instance: ${typeRef}): GmailDraftOutputConfig {`)
        parts.push(`    return new GmailDraftOutputConfig(${varName}[instance])`)
        parts.push("}")
        parts.push("")
    } else {
        const id = instances[0].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function GmailTrigger(): GmailConfig {`)
        parts.push(`    return new GmailConfig("${id}")`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function GmailSkill(): GmailOutputConfig {`)
        parts.push(`    return new GmailOutputConfig("${id}")`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` — creates draft emails */`)
        parts.push(`export function GmailDraftSkill(): GmailDraftOutputConfig {`)
        parts.push(`    return new GmailDraftOutputConfig("${id}")`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Slack ──────────────────────────────────────────────────────────────

function generateSlackSection(instances: SlackInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["SlackConfig", "SlackOutputConfig"])
    const parts: string[] = [sectionHeader("Slack"), ""]

    const multi = instances.length > 1
    const channelTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const channelClass = `SlackChannel${sfx}`
        channelTypes.push(channelClass)

        parts.push(generateResourceClass(channelClass, [
            { classField: "channelId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.channels))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Slack",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const channelUnion = channelTypes.join(" | ")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function SlackTrigger(instance: ${typeRef}, channel?: ${channelUnion}, listenToUserDms?: boolean, userIds?: string[]): SlackConfig {`)
        parts.push(`    return new SlackConfig(${varName}[instance], channel?.channelId, channel?.name, listenToUserDms, userIds)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function SlackSkill(instance: ${typeRef}, channel?: ${channelUnion}, userIds?: string[], userNames?: string[], listenToUserDms?: boolean): SlackOutputConfig {`)
        parts.push(`    return new SlackOutputConfig(${varName}[instance], channel?.channelId, channel?.name, userIds, userNames, listenToUserDms)`)
        parts.push("}")
        parts.push("")
    } else {
        const channelClass = channelTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function SlackTrigger(channel?: ${channelClass}, listenToUserDms?: boolean, userIds?: string[]): SlackConfig {`)
        parts.push(`    return new SlackConfig("${id}", channel?.channelId, channel?.name, listenToUserDms, userIds)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function SlackSkill(channel?: ${channelClass}, userIds?: string[], userNames?: string[], listenToUserDms?: boolean): SlackOutputConfig {`)
        parts.push(`    return new SlackOutputConfig("${id}", channel?.channelId, channel?.name, userIds, userNames, listenToUserDms)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Figma ─────────────────────────────────────────────────────────────

function generateFigmaSection(instances: IntegrationInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["FigmaConfig"])
    const parts: string[] = [sectionHeader("Figma"), ""]

    const multi = instances.length > 1

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Figma",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function FigmaTrigger(instance: ${typeRef}, fileKey: string, fileName: string, teamId: string): FigmaConfig {`)
        parts.push(`    return new FigmaConfig(${varName}[instance], fileKey, fileName, teamId)`)
        parts.push("}")
        parts.push("")
    } else {
        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function FigmaTrigger(fileKey: string, fileName: string, teamId: string): FigmaConfig {`)
        parts.push(`    return new FigmaConfig("${instances[0].id}", fileKey, fileName, teamId)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Linear ────────────────────────────────────────────────────────────

function generateLinearSection(instances: LinearInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["LinearInputConfig", "LinearOutputConfig"])
    const parts: string[] = [sectionHeader("Linear"), ""]

    const multi = instances.length > 1
    const teamTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const teamClass = `LinearTeam${sfx}`
        teamTypes.push(teamClass)

        parts.push(generateResourceClass(teamClass, [
            { classField: "teamId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
            { classField: "key", type: "string", sourceField: "key" },
        ], "name", inst.teams))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Linear",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const teamUnion = teamTypes.join(" | ")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function LinearTrigger(instance: ${typeRef}, projectId?: string, projectName?: string): LinearInputConfig {`)
        parts.push(`    return new LinearInputConfig(${varName}[instance], projectId, projectName)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function LinearSkill(instance: ${typeRef}, team?: ${teamUnion}, projectId?: string, projectName?: string): LinearOutputConfig {`)
        parts.push(`    return new LinearOutputConfig(${varName}[instance], team?.teamId, team?.name, projectId, projectName)`)
        parts.push("}")
        parts.push("")
    } else {
        const teamClass = teamTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function LinearTrigger(projectId?: string, projectName?: string): LinearInputConfig {`)
        parts.push(`    return new LinearInputConfig("${id}", projectId, projectName)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function LinearSkill(team?: ${teamClass}, projectId?: string, projectName?: string): LinearOutputConfig {`)
        parts.push(`    return new LinearOutputConfig("${id}", team?.teamId, team?.name, projectId, projectName)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Jira & Confluence (Atlassian) ─────────────────────────────────────

function generateAtlassianSection(instances: AtlassianInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["JiraConfig", "ConfluenceConfig"])
    const parts: string[] = [sectionHeader("Jira & Confluence"), ""]

    const multi = instances.length > 1
    const projectTypes: string[] = []
    const pageTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const projectClass = `JiraProject${sfx}`
        const pageClass = `ConfluencePage${sfx}`
        projectTypes.push(projectClass)
        pageTypes.push(pageClass)

        parts.push(generateResourceClass(projectClass, [
            { classField: "projectKey", type: "string", sourceField: "key" },
            { classField: "projectId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.jiraProjects))
        parts.push("")

        parts.push(generateResourceClass(pageClass, [
            { classField: "pageId", type: "string", sourceField: "id" },
            { classField: "title", type: "string", sourceField: "title" },
            { classField: "spaceId", type: "string", sourceField: "spaceId" },
            { classField: "spaceName", type: "string", sourceField: "spaceName" },
        ], "title", inst.confluencePages))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Atlassian",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const projectUnion = projectTypes.join(" | ")
        const pageUnion = pageTypes.join(" | ")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function JiraTrigger(instance: ${typeRef}, project?: ${projectUnion}): JiraConfig {`)
        parts.push(`    return new JiraConfig(${varName}[instance], project?.projectKey, project?.projectId)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function JiraSkill(instance: ${typeRef}, project?: ${projectUnion}): JiraConfig {`)
        parts.push(`    return new JiraConfig(${varName}[instance], project?.projectKey, project?.projectId)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function ConfluenceSkill(instance: ${typeRef}, page: ${pageUnion}): ConfluenceConfig {`)
        parts.push(`    return new ConfluenceConfig(${varName}[instance], page.spaceName, page.spaceId, page.pageId, page.title)`)
        parts.push("}")
        parts.push("")
    } else {
        const projectClass = projectTypes[0]
        const pageClass = pageTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function JiraTrigger(project?: ${projectClass}): JiraConfig {`)
        parts.push(`    return new JiraConfig("${id}", project?.projectKey, project?.projectId)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function JiraSkill(project?: ${projectClass}): JiraConfig {`)
        parts.push(`    return new JiraConfig("${id}", project?.projectKey, project?.projectId)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function ConfluenceSkill(page: ${pageClass}): ConfluenceConfig {`)
        parts.push(`    return new ConfluenceConfig("${id}", page.spaceName, page.spaceId, page.pageId, page.title)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Notion ────────────────────────────────────────────────────────────

function generateNotionSection(instances: NotionInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["NotionConfig"])
    const parts: string[] = [sectionHeader("Notion"), ""]

    const multi = instances.length > 1
    const dbTypes: string[] = []
    const pageTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const dbClass = `NotionDatabase${sfx}`
        const pageClass = `NotionPage${sfx}`
        dbTypes.push(dbClass)
        pageTypes.push(pageClass)

        parts.push(generateResourceClass(dbClass, [
            { classField: "databaseId", type: "string", sourceField: "id" },
            { classField: "title", type: "string", sourceField: "title" },
        ], "title", inst.databases))
        parts.push("")

        parts.push(generateResourceClass(pageClass, [
            { classField: "pageId", type: "string", sourceField: "id" },
            { classField: "title", type: "string", sourceField: "title" },
        ], "title", inst.pages))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Notion",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const dbUnion = dbTypes.join(" | ")
        const pageUnion = pageTypes.join(" | ")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function NotionSkill(instance: ${typeRef}, databases?: (${dbUnion})[], pages?: (${pageUnion})[]): NotionConfig {`)
        parts.push(`    return new NotionConfig(${varName}[instance],`)
        parts.push(`        databases?.map(d => d.databaseId), databases?.map(d => d.title),`)
        parts.push(`        pages?.map(p => p.pageId), pages?.map(p => p.title))`)
        parts.push("}")
        parts.push("")
    } else {
        const dbClass = dbTypes[0]
        const pageClass = pageTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function NotionSkill(databases?: ${dbClass}[], pages?: ${pageClass}[]): NotionConfig {`)
        parts.push(`    return new NotionConfig("${id}",`)
        parts.push(`        databases?.map(d => d.databaseId), databases?.map(d => d.title),`)
        parts.push(`        pages?.map(p => p.pageId), pages?.map(p => p.title))`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── PostHog ───────────────────────────────────────────────────────────

function generatePosthogSection(instances: PosthogInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["PosthogConfig"])
    const parts: string[] = [sectionHeader("PostHog"), ""]

    const multi = instances.length > 1
    const projTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const projClass = `PosthogProject${sfx}`
        projTypes.push(projClass)

        parts.push(generateResourceClass(projClass, [
            { classField: "projectId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.projects))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Posthog",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const projUnion = projTypes.join(" | ")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function PosthogSkill(instance: ${typeRef}, project: ${projUnion}): PosthogConfig {`)
        parts.push(`    return new PosthogConfig(${varName}[instance], project.projectId, project.name)`)
        parts.push("}")
        parts.push("")
    } else {
        const projClass = projTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function PosthogSkill(project: ${projClass}): PosthogConfig {`)
        parts.push(`    return new PosthogConfig("${id}", project.projectId, project.name)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Datadog ───────────────────────────────────────────────────────────

function generateDatadogSection(instances: DatadogInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["DatadogConfig"])
    const parts: string[] = [sectionHeader("Datadog"), ""]

    const multi = instances.length > 1
    const indexTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const indexClass = `DatadogIndex${sfx}`
        indexTypes.push(indexClass)

        parts.push(generateResourceClass(indexClass, [
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.indexes))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Datadog",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const indexUnion = indexTypes.join(" | ")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function DatadogSkill(instance: ${typeRef}, indexes?: (${indexUnion})[]): DatadogConfig {`)
        parts.push(`    return new DatadogConfig(${varName}[instance], indexes?.map(i => i.name))`)
        parts.push("}")
        parts.push("")
    } else {
        const indexClass = indexTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function DatadogSkill(indexes?: ${indexClass}[]): DatadogConfig {`)
        parts.push(`    return new DatadogConfig("${id}", indexes?.map(i => i.name))`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── LaunchDarkly ──────────────────────────────────────────────────────

function generateLaunchDarklySection(instances: LaunchDarklyInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["LaunchDarklyConfig"])
    const parts: string[] = [sectionHeader("LaunchDarkly"), ""]

    const multi = instances.length > 1
    const projTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const projClass = `LaunchDarklyProject${sfx}`
        projTypes.push(projClass)

        parts.push(generateResourceClass(projClass, [
            { classField: "projectKey", type: "string", sourceField: "key" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.projects))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "LaunchDarkly",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const projUnion = projTypes.join(" | ")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function LaunchDarklySkill(instance: ${typeRef}, project: ${projUnion}, environmentKeys: string[]): LaunchDarklyConfig {`)
        parts.push(`    return new LaunchDarklyConfig(${varName}[instance], project.projectKey, environmentKeys)`)
        parts.push("}")
        parts.push("")
    } else {
        const projClass = projTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function LaunchDarklySkill(project: ${projClass}, environmentKeys: string[]): LaunchDarklyConfig {`)
        parts.push(`    return new LaunchDarklyConfig("${id}", project.projectKey, environmentKeys)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── WorkOS ────────────────────────────────────────────────────────────

function generateWorkOSSection(instances: IntegrationInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["WorkOSInputConfig", "WorkOSOutputConfig"])
    const parts: string[] = [sectionHeader("WorkOS"), ""]

    const multi = instances.length > 1

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "WorkOS",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function WorkOSTrigger(instance: ${typeRef}, eventTypes?: string[]): WorkOSInputConfig {`)
        parts.push(`    return new WorkOSInputConfig(${varName}[instance], eventTypes)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function WorkOSSkill(instance: ${typeRef}): WorkOSOutputConfig {`)
        parts.push(`    return new WorkOSOutputConfig(${varName}[instance])`)
        parts.push("}")
        parts.push("")
    } else {
        const id = instances[0].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export function WorkOSTrigger(eventTypes?: string[]): WorkOSInputConfig {`)
        parts.push(`    return new WorkOSInputConfig("${id}", eventTypes)`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function WorkOSSkill(): WorkOSOutputConfig {`)
        parts.push(`    return new WorkOSOutputConfig("${id}")`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Attio ─────────────────────────────────────────────────────────────

function generateAttioSection(instances: AttioInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["AttioOutputConfig"])
    const parts: string[] = [sectionHeader("Attio"), ""]

    const multi = instances.length > 1
    const objTypes: string[] = []

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = multi ? suffix(instances, i) : ""
        const objClass = `AttioObject${sfx}`
        objTypes.push(objClass)

        parts.push(generateResourceClass(objClass, [
            { classField: "apiSlug", type: "string", sourceField: "api_slug" },
            { classField: "name", type: "string", sourceField: "singular_noun" },
        ], "singular_noun", inst.objects))
        parts.push("")
    }

    if (multi) {
        const { typeRef, varName } = generateInstanceLookup(parts, "Attio",
            instances.map(inst => ({ id: inst.id, name: inst.displayName })))
        const objUnion = objTypes.join(" | ")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function AttioSkill(instance: ${typeRef}, object?: ${objUnion}): AttioOutputConfig {`)
        parts.push(`    return new AttioOutputConfig(${varName}[instance], object?.apiSlug)`)
        parts.push("}")
        parts.push("")
    } else {
        const objClass = objTypes[0]
        const id = instances[0].id

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export function AttioSkill(object?: ${objClass}): AttioOutputConfig {`)
        parts.push(`    return new AttioOutputConfig("${id}", object?.apiSlug)`)
        parts.push("}")
        parts.push("")
    }

    return { code: parts.join("\n"), imports }
}

// ── Typed Tools ───────────────────────────────────────────────────────

/**
 * Converts a displayName like "Create ticket" to camelCase like "createTicket".
 */
function toCamelCase(s: string): string {
    const pascal = toPascalCase(s)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Converts a tool name like "linear_create_ticket" to a PascalCase interface name
 * like "LinearCreateTicketParams".
 */
function toolNameToInterfaceName(name: string): string {
    return name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("") + "Params"
}

/**
 * Converts a JSON Schema type to a TypeScript type string.
 * Handles nested objects, arrays, enums, anyOf (nullable), and primitives.
 */
function jsonSchemaToTs(schema: JsonSchema, indent: number): string {
    if (!schema) return "unknown"

    // Handle enums
    if (schema.enum) {
        return schema.enum.map(v => typeof v === "string" ? `"${escapeString(v)}"` : String(v)).join(" | ")
    }

    // Handle anyOf (commonly used for nullable: [X, { type: "null" }])
    if (schema.anyOf) {
        const nonNull = schema.anyOf.filter(s => s.type !== "null")
        const hasNull = schema.anyOf.some(s => s.type === "null")
        if (nonNull.length === 1 && hasNull) {
            return `${jsonSchemaToTs(nonNull[0], indent)} | null`
        }
        return schema.anyOf.map(s => jsonSchemaToTs(s, indent)).join(" | ")
    }

    switch (schema.type) {
        case "string":
            return "string"
        case "number":
        case "integer":
            return "number"
        case "boolean":
            return "boolean"
        case "array":
            if (schema.items) {
                const itemType = jsonSchemaToTs(schema.items, indent)
                // Wrap union types in parens for array
                return itemType.includes("|") ? `(${itemType})[]` : `${itemType}[]`
            }
            return "unknown[]"
        case "object": {
            if (!schema.properties || Object.keys(schema.properties).length === 0) {
                return "Record<string, unknown>"
            }
            const requiredSet = new Set(schema.required || [])
            const pad = " ".repeat(indent)
            const innerPad = " ".repeat(indent + 4)
            const entries = Object.entries(schema.properties).map(([key, prop]) => {
                const optional = requiredSet.has(key) ? "" : "?"
                const tsType = jsonSchemaToTs(prop, indent + 4)
                const desc = prop.description ? ` /** ${prop.description} */\n${innerPad}` : ""
                return `${desc}${key}${optional}: ${tsType}`
            })
            return `{\n${innerPad}${entries.join(`\n${innerPad}`)}\n${pad}}`
        }
        default:
            return "unknown"
    }
}

function generateToolsSection(tools: ToolDefinition[], input: CodegenInput): SectionResult {
    if (tools.length === 0) return EMPTY_SECTION

    const imports = new Set(["TerseAgent", "ToolOutputByName"])
    const parts: string[] = [sectionHeader("Typed Tools"), ""]

    // Build instance map: integration type → instances with id & displayName
    const instanceMap = new Map<string, { id: string; displayName: string }[]>()
    instanceMap.set("slack", input.slack.map(s => ({ id: s.id, displayName: s.displayName })))
    instanceMap.set("github", input.github.map(g => ({ id: g.integration.id, displayName: g.integration.account_name || "" })))
    instanceMap.set("gmail", input.gmail.map(g => ({ id: g.id, displayName: g.displayName })))
    instanceMap.set("figma", input.figma.map(f => ({ id: f.id, displayName: f.displayName })))
    instanceMap.set("linear", input.linear.map(l => ({ id: l.id, displayName: l.displayName })))
    instanceMap.set("jira", input.atlassian.map(a => ({ id: a.id, displayName: a.displayName })))
    instanceMap.set("confluence", input.atlassian.map(a => ({ id: a.id, displayName: a.displayName })))
    instanceMap.set("atlassian", input.atlassian.map(a => ({ id: a.id, displayName: a.displayName })))
    instanceMap.set("notion", input.notion.map(n => ({ id: n.id, displayName: n.displayName })))
    instanceMap.set("posthog", input.posthog.map(p => ({ id: p.id, displayName: p.displayName })))
    instanceMap.set("datadog", input.datadog.map(d => ({ id: d.id, displayName: d.displayName })))
    instanceMap.set("launchdarkly", input.launchdarkly.map(l => ({ id: l.id, displayName: l.displayName })))
    instanceMap.set("workos", input.workos.map(w => ({ id: w.id, displayName: w.displayName })))
    instanceMap.set("attio", input.attio.map(a => ({ id: a.id, displayName: a.displayName })))

    // Group tools by integration
    const byIntegration = new Map<string, ToolDefinition[]>()
    for (const tool of tools) {
        const key = tool.integration.toLowerCase()
        if (!byIntegration.has(key)) byIntegration.set(key, [])
        byIntegration.get(key)!.push(tool)
    }

    // Check if a tool has integrationId that should be auto-filled
    const hasAutoFillId = (tool: ToolDefinition): boolean =>
        tool.parameters.properties?.integrationId !== undefined

    // Clone a schema with integrationId removed from properties and required
    const omitIntegrationId = (schema: JsonSchema): JsonSchema => {
        const cloned = { ...schema }
        if (cloned.properties) {
            cloned.properties = Object.fromEntries(
                Object.entries(cloned.properties).filter(([key]) => key !== "integrationId")
            )
        }
        if (cloned.required) {
            cloned.required = cloned.required.filter(r => r !== "integrationId")
        }
        return cloned
    }

    // Ensure GitHub repository params are full "owner/repo".
    // Supports:
    // - Repository objects (uses .fullName)
    // - full string "owner/repo" (passthrough)
    // - short repo name string "repo" (resolved via known generated repositories when unique)
    const normalizeGitHubRepositoryParams = (toolName: string): string => {
        switch (toolName) {
            case "readGitHubFile":
            case "listGitHubPullRequests":
            case "listGitHubDirectory":
            case "listGitHubCommits":
            case "summarizeGitHubPullRequestDiff":
                return "{ ...params, repository: __normalizeGitHubRepository((params as any).repository) }"
            case "searchGitHubCode":
            case "grepGitHubCode":
                return "{ ...params, repositoryNames: __normalizeGitHubRepositoryNames((params as any).repositoryNames) }"
            default:
                return "params"
        }
    }

    // Generate per-tool param types (with integrationId omitted where applicable)
    for (const tool of tools) {
        const typeName = toolNameToInterfaceName(tool.name)
        const schema = hasAutoFillId(tool) ? omitIntegrationId(tool.parameters) : tool.parameters
        const tsType = jsonSchemaToTs(schema, 0)

        if (tool.description) {
            parts.push(`/** ${tool.description} */`)
        }
        // Always use `type` (not `interface`) so params are assignable to Record<string, unknown>
        parts.push(`export type ${typeName} = ${tsType}`)
        parts.push("")
    }

    // Build tool groups: each group has a key, raw integration, tools, and optional baked-in integrationId
    const groups: { key: string; integration: string; tools: ToolDefinition[]; integrationId?: string }[] = []

    for (const [integration, integrationTools] of byIntegration) {
        const needsAutoFill = integrationTools.some(hasAutoFillId)

        if (needsAutoFill) {
            const instances = instanceMap.get(integration) || []
            if (instances.length === 0) continue  // Skip tools with no matching instances

            for (let i = 0; i < instances.length; i++) {
                const sfx = suffix(instances, i)
                groups.push({ key: integration + sfx, integration, tools: integrationTools, integrationId: instances[i].id })
            }
        } else {
            groups.push({ key: integration, integration, tools: integrationTools })
        }
    }

    groups.sort((a, b) => a.key.localeCompare(b.key))

    const githubToolsExist = groups.some(g => g.integration === "github")
    if (githubToolsExist) {
        const githubRepoFullNames = Array.from(
            new Set(
                input.github.flatMap(g => g.repositories.map(r => (r.owner && r.name ? `${r.owner}/${r.name}` : r.name).trim())).filter(Boolean)
            )
        )

        const nameToFullName = new Map<string, string>()
        const ambiguousNames = new Set<string>()
        for (const fullName of githubRepoFullNames) {
            const [, repoName = fullName] = fullName.split("/", 2)
            if (nameToFullName.has(repoName) && nameToFullName.get(repoName) !== fullName) {
                ambiguousNames.add(repoName)
                nameToFullName.delete(repoName)
            } else if (!ambiguousNames.has(repoName)) {
                nameToFullName.set(repoName, fullName)
            }
        }

        parts.push(`const __githubRepoNameToFullName = new Map<string, string>([`)
        for (const [name, fullName] of Array.from(nameToFullName.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
            parts.push(`    ["${escapeString(name)}", "${escapeString(fullName)}"],`)
        }
        parts.push(`])`)
        parts.push("")
        parts.push(`function __normalizeGitHubRepository(repo: unknown): string {`)
        parts.push(`    if (repo && typeof repo === "object" && "fullName" in (repo as Record<string, unknown>)) {`)
        parts.push(`        const fullName = (repo as { fullName?: unknown }).fullName`)
        parts.push(`        if (typeof fullName === "string" && fullName.length > 0) return fullName`)
        parts.push(`    }`)
        parts.push(`    if (typeof repo === "string") {`)
        parts.push(`        if (repo.includes("/")) return repo`)
        parts.push(`        return __githubRepoNameToFullName.get(repo) ?? repo`)
        parts.push(`    }`)
        parts.push(`    return String(repo ?? "")`)
        parts.push(`}`)
        parts.push("")
        parts.push(`function __normalizeGitHubRepositoryNames(repositories: unknown): string[] {`)
        parts.push(`    if (!Array.isArray(repositories)) return []`)
        parts.push(`    return repositories.map(repo => __normalizeGitHubRepository(repo))`)
        parts.push(`}`)
        parts.push("")
    }

    // Generate the GeneratedTools type
    parts.push("export type GeneratedTools = {")
    for (const group of groups) {
        parts.push(`    ${group.key}: {`)
        for (const tool of group.tools) {
            const methodName = toCamelCase(tool.displayName)
            const paramsType = toolNameToInterfaceName(tool.name)
            if (tool.description) {
                parts.push(`        /** ${tool.description} */`)
            }
            parts.push(`        ${methodName}(params: ${paramsType}): Promise<ToolOutputByName["${escapeString(tool.name)}"]>`)
        }
        parts.push("    }")
    }
    parts.push("}")
    parts.push("")

    // Module augmentation — adds `tools` to TerseAgent's type
    parts.push('declare module "terse-sdk" {')
    parts.push("    interface TerseAgent {")
    parts.push("        readonly tools: GeneratedTools")
    parts.push("    }")
    parts.push("}")
    parts.push("")

    // Runtime: factory that builds the tools object for a given agent instance,
    // filtered to only include tools whose integration matches the agent's skills.
    parts.push("function createTools(agent: TerseAgent): GeneratedTools {")
    parts.push("    const allowed: Set<string> = new Set(agent.skills.map(s => s.integrationType))")
    parts.push("    return {")

    for (const group of groups) {
        const intType = toolIntegrationToIntegrationType(group.integration)
        parts.push(`        ...(allowed.has("${escapeString(intType)}") ? { ${group.key}: {`)
        for (const tool of group.tools) {
            const methodName = toCamelCase(tool.displayName)
            const paramsType = toolNameToInterfaceName(tool.name)
            const normalizedParamsExpr = group.integration === "github" ? normalizeGitHubRepositoryParams(tool.name) : "params"
            if (group.integrationId && hasAutoFillId(tool)) {
                parts.push(`            ${methodName}: (params: ${paramsType}) =>`)
                parts.push(
                    `                agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}), integrationId: "${escapeString(group.integrationId)}" }),`
                )
            } else {
                parts.push(`            ${methodName}: (params: ${paramsType}) =>`)
                parts.push(`                agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", ${normalizedParamsExpr}),`)
            }
        }
        parts.push(`        } } : {}),`)
    }

    parts.push("    } as GeneratedTools")
    parts.push("}")
    parts.push("")

    // Expose factory on globalThis for CLI (tsx may load a separate module instance)
    parts.push(";(globalThis as any).__terse_createTools = createTools")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── System (always included) ──────────────────────────────────────────

function generateSystemSection(): SectionResult {
    const imports = new Set(["TimeTriggerConfig", "TerseConfig"])
    const parts: string[] = []

    parts.push(sectionHeader("Schedule"))
    parts.push("")
    parts.push(`/** Use in \`triggers[]\` — run on a cron schedule */`)
    parts.push("export function ScheduleTrigger(cronExpression: string): TimeTriggerConfig {")
    parts.push("    return new TimeTriggerConfig(cronExpression)")
    parts.push("}")
    parts.push("")

    parts.push(sectionHeader("Terse"))
    parts.push("")
    parts.push(`/** Use in \`skills[]\` — built-in web search */`)
    parts.push("export function TerseSkill(): TerseConfig {")
    parts.push("    return new TerseConfig()")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Main Codegen Entry Point ──────────────────────────────────────────

export function generateCode(input: CodegenInput): string {
    const allImports = new Set<string>()
    const sections: string[] = []

    const sectionGenerators: SectionResult[] = [
        generateGitHubSection(input.github),
        generateGmailSection(input.gmail),
        generateSlackSection(input.slack),
        generateFigmaSection(input.figma),
        generateLinearSection(input.linear),
        generateAtlassianSection(input.atlassian),
        generateNotionSection(input.notion),
        generatePosthogSection(input.posthog),
        generateDatadogSection(input.datadog),
        generateLaunchDarklySection(input.launchdarkly),
        generateWorkOSSection(input.workos),
        generateAttioSection(input.attio),
        generateToolsSection(input.tools, input),
        generateSystemSection(),
    ]

    for (const section of sectionGenerators) {
        if (section.code) {
            sections.push(section.code)
            section.imports.forEach(i => allImports.add(i))
        }
    }

    // Build import statement
    const sortedImports = [...allImports].sort()
    const importLine = sortedImports.length <= 3
        ? `import { ${sortedImports.join(", ")} } from "terse-sdk"`
        : `import {\n    ${sortedImports.join(",\n    ")},\n} from "terse-sdk"`

    const header = [
        "// Auto-generated by `terse generate` — do not edit manually",
        "// Re-run `terse generate` to update.",
        "",
        importLine,
        "",
    ]

    return [...header, ...sections].join("\n")
}
