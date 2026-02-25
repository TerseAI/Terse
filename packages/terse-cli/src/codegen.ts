/**
 * Pure codegen function: integration data → TypeScript source text.
 * No I/O — all side effects live in generate.ts.
 */

import type { GithubIntegration } from "./shared/Integrations.js"

// ── Public Types ──────────────────────────────────────────────────────

export interface GitHubRepo { id: number; name: string; owner: string }
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = instances.length > 1
            ? toPascalCase(inst.integration.account_name || `Instance${i + 1}`)
            : ""
        const repoClass = `Repository${sfx}`
        const id = inst.integration.id

        parts.push(generateResourceClass(repoClass, [
            { classField: "repositoryId", type: "number", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.repositories))
        parts.push("")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class GithubTrigger${sfx} extends GitHubConfig {`)
        parts.push(`    constructor(repositories: ${repoClass}[]) {`)
        parts.push(`        super("${id}", repositories.map(r => r.repositoryId))`)
        parts.push("    }")
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class GithubSkill${sfx} extends GitHubConfig {`)
        parts.push(`    constructor(repositories: ${repoClass}[]) {`)
        parts.push(`        super("${id}", repositories.map(r => r.repositoryId))`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const sfx = suffix(instances, i)
        const id = instances[i].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class GmailTrigger${sfx} extends GmailConfig {`)
        parts.push(`    constructor() { super("${id}") }`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class GmailSkill${sfx} extends GmailOutputConfig {`)
        parts.push(`    constructor() { super("${id}") }`)
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` — creates draft emails */`)
        parts.push(`export class GmailDraftSkill${sfx} extends GmailDraftOutputConfig {`)
        parts.push(`    constructor() { super("${id}") }`)
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const channelClass = `SlackChannel${sfx}`

        parts.push(generateResourceClass(channelClass, [
            { classField: "channelId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.channels))
        parts.push("")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class SlackTrigger${sfx} extends SlackConfig {`)
        parts.push(`    constructor(channel?: ${channelClass}, listenToUserDms?: boolean, userIds?: string[]) {`)
        parts.push(`        super("${inst.id}", channel?.channelId, channel?.name, listenToUserDms, userIds)`)
        parts.push("    }")
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class SlackSkill${sfx} extends SlackOutputConfig {`)
        parts.push(`    constructor(channel?: ${channelClass}, userIds?: string[], userNames?: string[], listenToUserDms?: boolean) {`)
        parts.push(`        super("${inst.id}", channel?.channelId, channel?.name, userIds, userNames, listenToUserDms)`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const sfx = suffix(instances, i)

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class FigmaTrigger${sfx} extends FigmaConfig {`)
        parts.push(`    constructor(fileKey: string, fileName: string, teamId: string) {`)
        parts.push(`        super("${instances[i].id}", fileKey, fileName, teamId)`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const teamClass = `LinearTeam${sfx}`

        parts.push(generateResourceClass(teamClass, [
            { classField: "teamId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
            { classField: "key", type: "string", sourceField: "key" },
        ], "name", inst.teams))
        parts.push("")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class LinearTrigger${sfx} extends LinearInputConfig {`)
        parts.push(`    constructor(projectId?: string, projectName?: string) {`)
        parts.push(`        super("${inst.id}", projectId, projectName)`)
        parts.push("    }")
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class LinearSkill${sfx} extends LinearOutputConfig {`)
        parts.push(`    constructor(team?: ${teamClass}, projectId?: string, projectName?: string) {`)
        parts.push(`        super("${inst.id}", team?.teamId, team?.name, projectId, projectName)`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const projectClass = `JiraProject${sfx}`
        const pageClass = `ConfluencePage${sfx}`

        // Jira projects
        parts.push(generateResourceClass(projectClass, [
            { classField: "projectKey", type: "string", sourceField: "key" },
            { classField: "projectId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.jiraProjects))
        parts.push("")

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class JiraTrigger${sfx} extends JiraConfig {`)
        parts.push(`    constructor(project?: ${projectClass}) {`)
        parts.push(`        super("${inst.id}", project?.projectKey, project?.projectId)`)
        parts.push("    }")
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class JiraSkill${sfx} extends JiraConfig {`)
        parts.push(`    constructor(project?: ${projectClass}) {`)
        parts.push(`        super("${inst.id}", project?.projectKey, project?.projectId)`)
        parts.push("    }")
        parts.push("}")
        parts.push("")

        // Confluence pages
        parts.push(generateResourceClass(pageClass, [
            { classField: "pageId", type: "string", sourceField: "id" },
            { classField: "title", type: "string", sourceField: "title" },
            { classField: "spaceId", type: "string", sourceField: "spaceId" },
            { classField: "spaceName", type: "string", sourceField: "spaceName" },
        ], "title", inst.confluencePages))
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class ConfluenceSkill${sfx} extends ConfluenceConfig {`)
        parts.push(`    constructor(page: ${pageClass}) {`)
        parts.push(`        super("${inst.id}", page.spaceName, page.spaceId, page.pageId, page.title)`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const dbClass = `NotionDatabase${sfx}`
        const pageClass = `NotionPage${sfx}`

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

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class NotionSkill${sfx} extends NotionConfig {`)
        parts.push(`    constructor(databases?: ${dbClass}[], pages?: ${pageClass}[]) {`)
        parts.push(`        super("${inst.id}",`)
        parts.push(`            databases?.map(d => d.databaseId), databases?.map(d => d.title),`)
        parts.push(`            pages?.map(p => p.pageId), pages?.map(p => p.title))`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const projClass = `PosthogProject${sfx}`

        parts.push(generateResourceClass(projClass, [
            { classField: "projectId", type: "string", sourceField: "id" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.projects))
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class PosthogSkill${sfx} extends PosthogConfig {`)
        parts.push(`    constructor(project: ${projClass}) {`)
        parts.push(`        super("${inst.id}", project.projectId, project.name)`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const indexClass = `DatadogIndex${sfx}`

        parts.push(generateResourceClass(indexClass, [
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.indexes))
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class DatadogSkill${sfx} extends DatadogConfig {`)
        parts.push(`    constructor(indexes?: ${indexClass}[]) {`)
        parts.push(`        super("${inst.id}", indexes?.map(i => i.name))`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const projClass = `LaunchDarklyProject${sfx}`

        parts.push(generateResourceClass(projClass, [
            { classField: "projectKey", type: "string", sourceField: "key" },
            { classField: "name", type: "string", sourceField: "name" },
        ], "name", inst.projects))
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class LaunchDarklySkill${sfx} extends LaunchDarklyConfig {`)
        parts.push(`    constructor(project: ${projClass}, environmentKeys: string[]) {`)
        parts.push(`        super("${inst.id}", project.projectKey, environmentKeys)`)
        parts.push("    }")
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

    for (let i = 0; i < instances.length; i++) {
        const sfx = suffix(instances, i)
        const id = instances[i].id

        parts.push(`/** Use in \`triggers[]\` */`)
        parts.push(`export class WorkOSTrigger${sfx} extends WorkOSInputConfig {`)
        parts.push(`    constructor(eventTypes?: string[]) {`)
        parts.push(`        super("${id}", eventTypes)`)
        parts.push("    }")
        parts.push("}")
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class WorkOSSkill${sfx} extends WorkOSOutputConfig {`)
        parts.push(`    constructor() { super("${id}") }`)
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const sfx = suffix(instances, i)
        const objClass = `AttioObject${sfx}`

        parts.push(generateResourceClass(objClass, [
            { classField: "apiSlug", type: "string", sourceField: "api_slug" },
            { classField: "name", type: "string", sourceField: "singular_noun" },
        ], "singular_noun", inst.objects))
        parts.push("")

        parts.push(`/** Use in \`skills[]\` */`)
        parts.push(`export class AttioSkill${sfx} extends AttioOutputConfig {`)
        parts.push(`    constructor(object?: ${objClass}) {`)
        parts.push(`        super("${inst.id}", object?.apiSlug)`)
        parts.push("    }")
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

    const imports = new Set(["TerseAgent"])
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
            parts.push(`        ${methodName}(params: ${paramsType}): Promise<unknown>`)
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
            if (group.integrationId && hasAutoFillId(tool)) {
                parts.push(`            ${methodName}: (params: ${paramsType}) =>`)
                parts.push(`                agent.executeTool("${escapeString(tool.name)}", { ...params, integrationId: "${escapeString(group.integrationId)}" }),`)
            } else {
                parts.push(`            ${methodName}: (params: ${paramsType}) =>`)
                parts.push(`                agent.executeTool("${escapeString(tool.name)}", params),`)
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
    parts.push("export class ScheduleTrigger extends TimeTriggerConfig {")
    parts.push("    constructor(cronExpression: string) {")
    parts.push("        super(cronExpression)")
    parts.push("    }")
    parts.push("}")
    parts.push("")

    parts.push(sectionHeader("Terse"))
    parts.push("")
    parts.push(`/** Use in \`skills[]\` — built-in web search */`)
    parts.push("export class TerseSkill extends TerseConfig {")
    parts.push("    constructor() {")
    parts.push("        super()")
    parts.push("    }")
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
