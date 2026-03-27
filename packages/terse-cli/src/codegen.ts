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
export interface SnowflakeInstanceData {id: string; name: string}
export interface AttioAttributeData {
    api_slug?: string
    title?: string
    type?: string
    is_required?: boolean
    is_unique?: boolean
}
export interface AttioObjectData { api_slug: string; singular_noun: string; plural_noun?: string; attributes?: AttioAttributeData[] }

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
    supportsApproval: boolean
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
    snowflake: SnowflakeInstanceData[]
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

function toGeneratedIdentifier(raw: string, fallback: string): string {
    let name = toPascalCase(raw || fallback)
    if (!name) name = fallback
    if (/^\d/.test(name)) name = `_${name}`
    return name
}

function isProbablyAttioMultiValue(attr: AttioAttributeData): boolean {
    const slug = (attr.api_slug || "").toLowerCase()
    const type = (attr.type || "").toLowerCase()

    return (
        type.includes("multi") ||
        type.includes("array") ||
        type.includes("list") ||
        slug === "email_addresses" ||
        slug === "domains" ||
        slug === "phone_numbers" ||
        slug === "social_profiles" ||
        slug === "links" ||
        slug === "tags" ||
        slug.endsWith("_addresses") ||
        slug.endsWith("_ids")
    )
}

function attioAttributeBaseType(attr: AttioAttributeData): string {
    const slug = (attr.api_slug || "").toLowerCase()
    const type = (attr.type || "").toLowerCase()

    if (type.includes("checkbox") || type.includes("boolean")) return "boolean"
    if (type.includes("number") || type.includes("currency") || type.includes("rating") || type.includes("percent")) return "number"
    if (type.includes("date") || type.includes("time")) return "string"
    if (
        type.includes("email") ||
        type.includes("domain") ||
        type.includes("phone") ||
        type.includes("url") ||
        type.includes("select") ||
        type.includes("status") ||
        type.includes("text") ||
        type.includes("string") ||
        type.includes("name")
    ) {
        return "string"
    }
    if (
        type.includes("location") ||
        type.includes("address") ||
        type.includes("reference") ||
        type.includes("record") ||
        type.includes("actor")
    ) {
        return "Record<string, unknown>"
    }
    if (slug === "email_addresses" || slug === "domains" || slug === "phone_numbers" || slug === "name") {
        return "string"
    }
    return "unknown"
}

function attioAttributeInputTsType(attr: AttioAttributeData): string {
    const baseType = attioAttributeBaseType(attr)
    if (!isProbablyAttioMultiValue(attr)) return baseType
    const arrayType = baseType.includes("|") ? `(${baseType})[]` : `${baseType}[]`
    return `${baseType} | ${arrayType}`
}

function attioAttributeRecordTsType(attr: AttioAttributeData): string {
    const baseType = attioAttributeBaseType(attr)
    if (!isProbablyAttioMultiValue(attr)) return baseType
    return baseType.includes("|") ? `(${baseType})[]` : `${baseType}[]`
}

function renderAttioObjectValueShape(attributes: AttioAttributeData[], mode: "input" | "record"): string {
    if (attributes.length === 0) return "Record<string, unknown>"

    const lines = attributes.map(attr => {
        const valueType = mode === "input" ? attioAttributeInputTsType(attr) : attioAttributeRecordTsType(attr)
        return `    "${escapeString(attr.api_slug || "")}"?: ${valueType}`
    })

    return `{\n${lines.join("\n")}\n}`
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

function renderStringLiteralUnion(values: string[]): string {
    if (values.length === 0) return "never"
    return values.map(value => `"${escapeString(value)}"`).join(" | ")
}

function buildSkillToolTypeForIntegration(tools: ToolDefinition[], integrationType: string): string {
    const toolNames = tools
        .filter(tool => toolIntegrationToIntegrationType(tool.integration.toLowerCase()) === integrationType)
        .filter(tool => !tool.isReadOnly || tool.supportsApproval)
        .map(tool => tool.name)
        .sort()

    return renderStringLiteralUnion(toolNames)
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

function generateGitHubSection(instances: GitHubInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["GitHubConfig"])
    const parts: string[] = [sectionHeader("GitHub"), ""]
    const id = inst.integration.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "github")

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

    parts.push("export class GithubOwner {")
    parts.push("    constructor(public readonly name: string) {}")
    if (ownerEntries.size > 0) {
        parts.push("")
        for (const [owner, data] of ownerEntries) {
            parts.push(`    static ${data.staticName} = new GithubOwner("${escapeString(owner)}")`)
        }
    }
    parts.push("}")
    parts.push("")

    parts.push("export class Repos {")
    parts.push("    constructor(")
    parts.push("        public readonly repositoryId: number,")
    parts.push("        public readonly name: string,")
    parts.push("        public readonly owner: GithubOwner,")
    parts.push("        public readonly fullName: string")
    parts.push("    ) {}")

    if (ownerEntries.size > 0) {
        parts.push("")
        for (const [, data] of ownerEntries) {
            const usedRepoNames = new Set<string>()
            parts.push(`    static ${data.staticName} = {`)
            for (const repo of data.repos) {
                let repoStaticName = toStaticName(repo.name, "Repos")
                while (usedRepoNames.has(repoStaticName)) repoStaticName += "_"
                usedRepoNames.add(repoStaticName)
                parts.push(
                    `        ${repoStaticName}: new Repos(${repo.id}, "${escapeString(repo.name)}", GithubOwner.${data.staticName}, "${escapeString(repo.fullName)}"),`
                )
            }
            parts.push("    } as const")
        }
    }

    parts.push("}")
    parts.push("")

    imports.add("GitHubEventType")
    imports.add("TypedTrigger")
    imports.add("TypedSkill")
    imports.add("GithubPRInputEvent")
    imports.add("GithubPushInputEvent")
    imports.add("GithubInputEvent")

    // Namespace object with typed event triggers
    parts.push("export const GitHub = {")
    parts.push(`    /** Trigger on push to a repository */`)
    parts.push(`    onPush(opts: { repo: Repos }): TypedTrigger<GithubPushInputEvent> {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PUSH]) as TypedTrigger<GithubPushInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when a pull request is opened */`)
    parts.push(`    onPROpened(opts: { repo: Repos }): TypedTrigger<GithubPRInputEvent> {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_OPENED]) as TypedTrigger<GithubPRInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when a pull request is merged */`)
    parts.push(`    onPRMerged(opts: { repo: Repos }): TypedTrigger<GithubPRInputEvent> {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_MERGED]) as TypedTrigger<GithubPRInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when a pull request is closed */`)
    parts.push(`    onPRClosed(opts: { repo: Repos }): TypedTrigger<GithubPRInputEvent> {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_CLOSED]) as TypedTrigger<GithubPRInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on any pull request event */`)
    parts.push(`    onPR(opts: { repo: Repos }): TypedTrigger<GithubPRInputEvent> {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_OPENED, GitHubEventType.PR_MERGED, GitHubEventType.PR_CLOSED, GitHubEventType.PR_SYNCHRONIZE]) as TypedTrigger<GithubPRInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on specific GitHub events for the given repositories */`)
    parts.push(`    trigger(opts: { repos: Repos[]; eventTypes?: GitHubEventType[] }): TypedTrigger<GithubInputEvent> {`)
    parts.push(`        return new GitHubConfig("${id}", opts.repos.map(r => r.repositoryId), opts.eventTypes) as TypedTrigger<GithubInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { repos: Repos[] }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new GitHubConfig("${id}", opts.repos.map(r => r.repositoryId)) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Gmail ─────────────────────────────────────────────────────────────

function generateGmailSection(instances: IntegrationInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["GmailConfig", "GmailOutputConfig", "GmailDraftOutputConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Gmail"), ""]
    const id = instances[0].id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "gmail")

    imports.add("GmailEventType")

    parts.push("export const Gmail = {")
    parts.push(`    /** Trigger when a new email is received */`)
    parts.push(`    onEmail(): GmailConfig {`)
    parts.push(`        return new GmailConfig("${id}", [GmailEventType.EMAIL_RECEIVED])`)
    parts.push("    },")
    parts.push(`    /** Trigger on all Gmail events */`)
    parts.push(`    trigger(opts?: { eventTypes?: GmailEventType[] }): GmailConfig {`)
    parts.push(`        return new GmailConfig("${id}", opts?.eventTypes)`)
    parts.push("    },")

    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new GmailOutputConfig("${id}") as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` — creates draft emails */`)
    parts.push(`    draftSkill(): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new GmailDraftOutputConfig("${id}") as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Slack ──────────────────────────────────────────────────────────────

function generateSlackSection(instances: SlackInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["SlackConfig", "SlackOutputConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Slack"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "slack")

    parts.push(generateResourceClass("SlackChannel", [
        { classField: "channelId", type: "string", sourceField: "id" },
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.channels))
    parts.push("")

    imports.add("SlackEventType")

    // Namespace object with typed event triggers
    parts.push("export const Slack = {")
    parts.push(`    /** Trigger on any message in a channel */`)
    parts.push(`    onMessage(opts: { channel: SlackChannel; userIds?: string[] }): SlackConfig {`)
    parts.push(`        return new SlackConfig("${id}", opts.channel.channelId, opts.channel.name, false, opts.userIds, [SlackEventType.MESSAGE])`)
    parts.push("    },")
    parts.push(`    /** Trigger on direct messages to the bot */`)
    parts.push(`    onDm(opts?: { userIds?: string[] }): SlackConfig {`)
    parts.push(`        return new SlackConfig("${id}", undefined, undefined, true, opts?.userIds, [SlackEventType.MESSAGE])`)
    parts.push("    },")
    parts.push(`    /** Trigger on all Slack events (messages + DMs) for a channel */`)
    parts.push(`    trigger(opts?: { channel?: SlackChannel; listenToUserDms?: boolean; userIds?: string[]; eventTypes?: SlackEventType[] }): SlackConfig {`)
    parts.push(`        return new SlackConfig("${id}", opts?.channel?.channelId, opts?.channel?.name, opts?.listenToUserDms, opts?.userIds, opts?.eventTypes)`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { channel?: SlackChannel; userIds?: string[]; userNames?: string[]; listenToUserDms?: boolean }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new SlackOutputConfig("${id}", opts?.channel?.channelId, opts?.channel?.name, opts?.userIds, opts?.userNames, opts?.listenToUserDms) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Figma ─────────────────────────────────────────────────────────────

function generateFigmaSection(instances: IntegrationInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["FigmaConfig"])
    const parts: string[] = [sectionHeader("Figma"), ""]
    const id = instances[0].id

    imports.add("FigmaEventType")

    parts.push("export const Figma = {")
    parts.push(`    /** Trigger when a comment is added to a Figma file */`)
    parts.push(`    onComment(opts: { fileKey: string; fileName: string; teamId: string }): FigmaConfig {`)
    parts.push(`        return new FigmaConfig("${id}", opts.fileKey, opts.fileName, opts.teamId, [FigmaEventType.FILE_COMMENT])`)
    parts.push("    },")
    parts.push(`    /** Trigger on all Figma events */`)
    parts.push(`    trigger(opts: { fileKey: string; fileName: string; teamId: string; eventTypes?: FigmaEventType[] }): FigmaConfig {`)
    parts.push(`        return new FigmaConfig("${id}", opts.fileKey, opts.fileName, opts.teamId, opts.eventTypes)`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Linear ────────────────────────────────────────────────────────────

function generateLinearSection(instances: LinearInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["LinearInputConfig", "LinearOutputConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Linear"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "linear")

    parts.push(generateResourceClass("LinearTeam", [
        { classField: "teamId", type: "string", sourceField: "id" },
        { classField: "name", type: "string", sourceField: "name" },
        { classField: "key", type: "string", sourceField: "key" },
    ], "name", inst.teams))
    parts.push("")

    imports.add("LinearEventType")

    parts.push("export const Linear = {")
    parts.push(`    /** Trigger when a new issue is created */`)
    parts.push(`    onIssueCreated(opts?: { projectId?: string; projectName?: string }): LinearInputConfig {`)
    parts.push(`        return new LinearInputConfig("${id}", opts?.projectId, opts?.projectName, [LinearEventType.ISSUE_CREATED])`)
    parts.push("    },")
    parts.push(`    /** Trigger when an issue is updated */`)
    parts.push(`    onIssueUpdated(opts?: { projectId?: string; projectName?: string }): LinearInputConfig {`)
    parts.push(`        return new LinearInputConfig("${id}", opts?.projectId, opts?.projectName, [LinearEventType.ISSUE_UPDATED])`)
    parts.push("    },")
    parts.push(`    /** Trigger when a comment is added to an issue */`)
    parts.push(`    onComment(opts?: { projectId?: string; projectName?: string }): LinearInputConfig {`)
    parts.push(`        return new LinearInputConfig("${id}", opts?.projectId, opts?.projectName, [LinearEventType.COMMENT_CREATED])`)
    parts.push("    },")
    parts.push(`    /** Trigger on all Linear events */`)
    parts.push(`    trigger(opts?: { projectId?: string; projectName?: string; eventTypes?: LinearEventType[] }): LinearInputConfig {`)
    parts.push(`        return new LinearInputConfig("${id}", opts?.projectId, opts?.projectName, opts?.eventTypes)`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { team?: LinearTeam; projectId?: string; projectName?: string }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new LinearOutputConfig("${id}", opts?.team?.teamId, opts?.team?.name, opts?.projectId, opts?.projectName) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Jira & Confluence (Atlassian) ─────────────────────────────────────

function generateAtlassianSection(instances: AtlassianInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["JiraConfig", "ConfluenceConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Jira & Confluence"), ""]
    const id = inst.id
    const atlassianSkillToolType = buildSkillToolTypeForIntegration(tools, "atlassian")

    parts.push(generateResourceClass("JiraProject", [
        { classField: "projectKey", type: "string", sourceField: "key" },
        { classField: "projectId", type: "string", sourceField: "id" },
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.jiraProjects))
    parts.push("")

    parts.push(generateResourceClass("ConfluencePage", [
        { classField: "pageId", type: "string", sourceField: "id" },
        { classField: "title", type: "string", sourceField: "title" },
        { classField: "spaceId", type: "string", sourceField: "spaceId" },
        { classField: "spaceName", type: "string", sourceField: "spaceName" },
    ], "title", inst.confluencePages))
    parts.push("")

    imports.add("JiraEventType")

    parts.push("export const Jira = {")
    parts.push(`    /** Trigger when a Jira issue is created */`)
    parts.push(`    onIssueCreated(opts?: { project?: JiraProject }): JiraConfig {`)
    parts.push(`        return new JiraConfig("${id}", opts?.project?.projectKey, opts?.project?.projectId, [JiraEventType.ISSUE_CREATED])`)
    parts.push("    },")
    parts.push(`    /** Trigger when a Jira issue is updated */`)
    parts.push(`    onIssueUpdated(opts?: { project?: JiraProject }): JiraConfig {`)
    parts.push(`        return new JiraConfig("${id}", opts?.project?.projectKey, opts?.project?.projectId, [JiraEventType.ISSUE_UPDATED])`)
    parts.push("    },")
    parts.push(`    /** Trigger on all Jira events */`)
    parts.push(`    trigger(opts?: { project?: JiraProject; eventTypes?: JiraEventType[] }): JiraConfig {`)
    parts.push(`        return new JiraConfig("${id}", opts?.project?.projectKey, opts?.project?.projectId, opts?.eventTypes)`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { project?: JiraProject }): TypedSkill<${atlassianSkillToolType}> {`)
    parts.push(`        return new JiraConfig("${id}", opts?.project?.projectKey, opts?.project?.projectId) as TypedSkill<${atlassianSkillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    parts.push("export const Confluence = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { page: ConfluencePage }): TypedSkill<${atlassianSkillToolType}> {`)
    parts.push(`        return new ConfluenceConfig("${id}", opts.page.spaceName, opts.page.spaceId, opts.page.pageId, opts.page.title) as TypedSkill<${atlassianSkillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Notion ────────────────────────────────────────────────────────────

function generateNotionSection(instances: NotionInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["NotionConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Notion"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "notion")

    parts.push(generateResourceClass("NotionDatabase", [
        { classField: "databaseId", type: "string", sourceField: "id" },
        { classField: "title", type: "string", sourceField: "title" },
    ], "title", inst.databases))
    parts.push("")

    parts.push(generateResourceClass("NotionPage", [
        { classField: "pageId", type: "string", sourceField: "id" },
        { classField: "title", type: "string", sourceField: "title" },
    ], "title", inst.pages))
    parts.push("")

    parts.push("export const Notion = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { databases?: NotionDatabase[]; pages?: NotionPage[] }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new NotionConfig("${id}",`)
    parts.push(`            opts?.databases?.map(d => d.databaseId), opts?.databases?.map(d => d.title),`)
    parts.push(`            opts?.pages?.map(p => p.pageId), opts?.pages?.map(p => p.title)) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── PostHog ───────────────────────────────────────────────────────────

function generatePosthogSection(instances: PosthogInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["PosthogConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("PostHog"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "posthog")

    parts.push(generateResourceClass("PosthogProject", [
        { classField: "projectId", type: "string", sourceField: "id" },
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.projects))
    parts.push("")

    parts.push("export const Posthog = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { project: PosthogProject }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new PosthogConfig("${id}", opts.project.projectId, opts.project.name) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Datadog ───────────────────────────────────────────────────────────

function generateDatadogSection(instances: DatadogInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["DatadogConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Datadog"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "datadog")

    parts.push(generateResourceClass("DatadogIndex", [
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.indexes))
    parts.push("")

    parts.push("export const Datadog = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { indexes?: DatadogIndex[] }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new DatadogConfig("${id}", opts?.indexes?.map(i => i.name)) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── LaunchDarkly ──────────────────────────────────────────────────────

function generateLaunchDarklySection(instances: LaunchDarklyInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["LaunchDarklyConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("LaunchDarkly"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "launchdarkly")

    parts.push(generateResourceClass("LaunchDarklyProject", [
        { classField: "projectKey", type: "string", sourceField: "key" },
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.projects))
    parts.push("")

    parts.push("export const LaunchDarkly = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { project: LaunchDarklyProject; environmentKeys: string[] }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new LaunchDarklyConfig("${id}", opts.project.projectKey, opts.environmentKeys) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── WorkOS ────────────────────────────────────────────────────────────

function generateWorkOSSection(instances: IntegrationInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["WorkOSInputConfig", "WorkOSOutputConfig", "WorkOSEventType", "TypedSkill"])
    const parts: string[] = [sectionHeader("WorkOS"), ""]
    const id = instances[0].id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "workos")

    imports.add("TypedTrigger")
    imports.add("WorkOSInputEvent")
    imports.add("WorkOSUserInputEvent")
    imports.add("WorkOSMembershipInputEvent")
    imports.add("WorkOSInvitationInputEvent")
    imports.add("WorkOSOrganizationInputEvent")

    parts.push("export const WorkOS = {")
    parts.push(`    /** Trigger on user creation */`)
    parts.push(`    onUserCreated(): TypedTrigger<WorkOSUserInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.USER_CREATED]) as TypedTrigger<WorkOSUserInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on user update */`)
    parts.push(`    onUserUpdated(): TypedTrigger<WorkOSUserInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.USER_UPDATED]) as TypedTrigger<WorkOSUserInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on user deletion */`)
    parts.push(`    onUserDeleted(): TypedTrigger<WorkOSUserInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.USER_DELETED]) as TypedTrigger<WorkOSUserInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on organization membership change */`)
    parts.push(`    onMembershipChanged(): TypedTrigger<WorkOSMembershipInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED, WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED, WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED]) as TypedTrigger<WorkOSMembershipInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when an invitation is sent */`)
    parts.push(`    onInvitationSent(): TypedTrigger<WorkOSInvitationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.INVITATION_CREATED, WorkOSEventType.INVITATION_RESENT]) as TypedTrigger<WorkOSInvitationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when an invitation is first created */`)
    parts.push(`    onInvitationCreated(): TypedTrigger<WorkOSInvitationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.INVITATION_CREATED]) as TypedTrigger<WorkOSInvitationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when an invitation is resent */`)
    parts.push(`    onInvitationResent(): TypedTrigger<WorkOSInvitationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.INVITATION_RESENT]) as TypedTrigger<WorkOSInvitationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on invitation accepted */`)
    parts.push(`    onInvitationAccepted(): TypedTrigger<WorkOSInvitationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.INVITATION_ACCEPTED]) as TypedTrigger<WorkOSInvitationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger when an invitation is revoked */`)
    parts.push(`    onInvitationRevoked(): TypedTrigger<WorkOSInvitationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.INVITATION_REVOKED]) as TypedTrigger<WorkOSInvitationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on organization creation */`)
    parts.push(`    onOrganizationCreated(): TypedTrigger<WorkOSOrganizationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", [WorkOSEventType.ORGANIZATION_CREATED]) as TypedTrigger<WorkOSOrganizationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Trigger on specific WorkOS event types */`)
    parts.push(`    trigger(opts?: { eventTypes?: WorkOSEventType[] }): TypedTrigger<WorkOSInputEvent | WorkOSUserInputEvent | WorkOSMembershipInputEvent | WorkOSInvitationInputEvent | WorkOSOrganizationInputEvent> {`)
    parts.push(`        return new WorkOSInputConfig("${id}", opts?.eventTypes) as TypedTrigger<WorkOSInputEvent | WorkOSUserInputEvent | WorkOSMembershipInputEvent | WorkOSInvitationInputEvent | WorkOSOrganizationInputEvent>`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new WorkOSOutputConfig("${id}") as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Attio ─────────────────────────────────────────────────────────────

function generateAttioSection(instances: AttioInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["AttioOutputConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Attio"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "attio")

    parts.push("export type AttioAttributeDefinition<TSlug extends string = string, TType extends string = string> = {")
    parts.push("    apiSlug: TSlug")
    parts.push("    title?: string")
    parts.push("    type?: TType")
    parts.push("    isRequired?: boolean")
    parts.push("    isUnique?: boolean")
    parts.push("}")
    parts.push("")
    parts.push("export class AttioObject<")
    parts.push("    TSlug extends string = string,")
    parts.push("    TRecordValues extends Record<string, unknown> = Record<string, unknown>,")
    parts.push("    TInputValues extends Record<string, unknown> = TRecordValues")
    parts.push("> {")
    parts.push("    constructor(")
    parts.push("        public readonly apiSlug: TSlug,")
    parts.push("        public readonly name: string,")
    parts.push("        public readonly attributes: readonly AttioAttributeDefinition[] = []")
    parts.push("    ) {}")
    parts.push("")
    parts.push("    declare readonly __recordValues: TRecordValues")
    parts.push("    declare readonly __inputValues: TInputValues")

    if (inst.objects.length > 0) {
        parts.push("")
        const usedNames = new Set<string>()
        for (const object of inst.objects) {
            let staticName = toGeneratedIdentifier(object.singular_noun || object.api_slug || "Object", "AttioObject")
            while (usedNames.has(staticName)) staticName += "_"
            usedNames.add(staticName)

            const attributes = (object.attributes || []).filter((attr): attr is AttioAttributeData & { api_slug: string } => !!attr.api_slug)
            const attributeSource = attributes.length === 0
                ? "[]"
                : `[\n${attributes.map(attr => {
                    const fields = [
                        `apiSlug: "${escapeString(attr.api_slug)}"`,
                        attr.title ? `title: "${escapeString(attr.title)}"` : undefined,
                        attr.type ? `type: "${escapeString(attr.type)}"` : undefined,
                        attr.is_required !== undefined ? `isRequired: ${attr.is_required ? "true" : "false"}` : undefined,
                        attr.is_unique !== undefined ? `isUnique: ${attr.is_unique ? "true" : "false"}` : undefined,
                    ].filter(Boolean).join(", ")
                    return `        { ${fields} }`
                }).join(",\n")}\n    ]`
            const recordValuesType = renderAttioObjectValueShape(attributes, "record")
            const inputValuesType = renderAttioObjectValueShape(attributes, "input")

            parts.push(
                `    static ${staticName} = new AttioObject<"${escapeString(object.api_slug)}", ${recordValuesType}, ${inputValuesType}>("${escapeString(object.api_slug)}", "${escapeString(object.singular_noun)}", ${attributeSource})`
            )
        }
    }

    parts.push("}")
    parts.push("")

    parts.push("export const Attio = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { object?: AttioObject<any> }): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new AttioOutputConfig("${id}", opts?.object?.apiSlug) as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Snowflake ─────────────────────────────────────────────────────────

function generateSnowflakeSection(instances: SnowflakeInstanceData[], tools: ToolDefinition[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["SnowflakeOutputConfig", "TypedSkill"])
    const parts: string[] = [sectionHeader("Snowflake"), ""]
    const id = inst.id
    const skillToolType = buildSkillToolTypeForIntegration(tools, "snowflake")

    parts.push("export const Snowflake = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new SnowflakeOutputConfig("${id}") as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

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
    instanceMap.set("snowflake", input.snowflake.map(s => ({ id: s.id, displayName: s.name })))

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
    // - Repos objects (uses .fullName)
    // - full string "owner/repo" (passthrough)
    // - short repo name string "repo" (resolved via known generated repositories when unique)
    const normalizeGitHubReposParams = (toolName: string): string => {
        switch (toolName) {
            case "readGitHubFile":
            case "listGitHubPullRequests":
            case "listGitHubDirectory":
            case "listGitHubCommits":
            case "summarizeGitHubPullRequestDiff":
                return "{ ...params, repository: __normalizeGitHubRepos((params as any).repository) }"
            case "searchGitHubCode":
            case "grepGitHubCode":
                return "{ ...params, repositoryNames: __normalizeGitHubReposNames((params as any).repositoryNames) }"
            default:
                return "params"
        }
    }

    const isAttioTool = (tool: ToolDefinition): boolean => tool.integration.toLowerCase() === "attio"
    const attioObjects = input.attio[0]?.objects ?? []
    const attioGeneratedObjects = (() => {
        const usedNames = new Set<string>()
        return attioObjects.map(object => {
            let staticName = toGeneratedIdentifier(object.singular_noun || object.api_slug || "Object", "AttioObject")
            while (usedNames.has(staticName)) staticName += "_"
            usedNames.add(staticName)
            return {
                ...object,
                staticName,
                attributes: (object.attributes || []).filter((attr): attr is AttioAttributeData & { api_slug: string } => !!attr.api_slug),
            }
        })
    })()

    if (tools.some(isAttioTool)) {
        parts.push("type __AttioPrimitive = string | number | boolean | null")
        parts.push("type __AttioStructuredValue = Record<string, unknown>")
        parts.push("type __AttioValue = __AttioPrimitive | __AttioStructuredValue | (__AttioPrimitive | __AttioStructuredValue)[]")
        parts.push("type __AttioFilterShorthand<T> = T extends (infer U)[] ? U | T : T")
        parts.push('type __AttioFilterValue<T> = __AttioFilterShorthand<T> | { $eq?: __AttioFilterShorthand<T>; $contains?: string; $starts_with?: string; $ends_with?: string } | Record<string, unknown>')
        parts.push('type __AttioFilterExpression<TValues extends Record<string, unknown>> = Partial<{ [K in keyof TValues]: __AttioFilterValue<TValues[K]> }> & { $and?: Array<__AttioFilterExpression<TValues>>; $or?: Array<__AttioFilterExpression<TValues>> }')
        parts.push('type __AttioRecordBase = NonNullable<NonNullable<ToolOutputByName["attio_upsert_record"]["records"]>[number]>')
        parts.push('type __AttioRecordWithValues<TValues extends Record<string, unknown>> = Omit<__AttioRecordBase, "values"> & TValues & { values: TValues; attributes: TValues }')
        parts.push("")

        if (attioGeneratedObjects.length > 0) {
            parts.push("export type GeneratedAttioObject =")
            for (const object of attioGeneratedObjects) {
                parts.push(`    | typeof AttioObject.${object.staticName}`)
            }
            parts.push("")

            parts.push("export type AttioInputValuesByObject = {")
            for (const object of attioGeneratedObjects) {
                const inputShape = object.attributes.length === 0 ? "Record<string, __AttioValue>" : renderAttioObjectValueShape(object.attributes, "input")
                parts.push(`    "${escapeString(object.api_slug)}": ${inputShape}`)
            }
            parts.push("}")
            parts.push("")

            parts.push("export type AttioRecordValuesByObject = {")
            for (const object of attioGeneratedObjects) {
                const recordShape = object.attributes.length === 0 ? "Record<string, __AttioValue>" : renderAttioObjectValueShape(object.attributes, "record")
                parts.push(`    "${escapeString(object.api_slug)}": ${recordShape}`)
            }
            parts.push("}")
            parts.push("")

            parts.push("export type AttioFilterByObject = {")
            for (const object of attioGeneratedObjects) {
                parts.push(`    "${escapeString(object.api_slug)}": __AttioFilterExpression<AttioRecordValuesByObject["${escapeString(object.api_slug)}"]>`)
            }
            parts.push("}")
            parts.push("")

            parts.push("export type AttioRecordByObject = {")
            for (const object of attioGeneratedObjects) {
                parts.push(`    "${escapeString(object.api_slug)}": __AttioRecordWithValues<AttioRecordValuesByObject["${escapeString(object.api_slug)}"]>`)
            }
            parts.push("}")
        } else {
            parts.push("export type GeneratedAttioObject = AttioObject<string, Record<string, __AttioValue>, Record<string, __AttioValue>>")
            parts.push('export type AttioInputValuesByObject = Record<string, Record<string, __AttioValue>>')
            parts.push('export type AttioRecordValuesByObject = Record<string, Record<string, __AttioValue>>')
            parts.push('export type AttioFilterByObject = Record<string, __AttioFilterExpression<Record<string, __AttioValue>>>')
            parts.push('export type AttioRecordByObject = Record<string, __AttioRecordWithValues<Record<string, __AttioValue>>>')
        }

        parts.push("")
        parts.push('export type AttioValuesFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = TObject extends { __inputValues: infer TInputValues } ? TInputValues : AttioInputValuesByObject[TObject["apiSlug"]]')
        parts.push('export type AttioRecordValuesFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = TObject extends { __recordValues: infer TRecordValues } ? TRecordValues : AttioRecordValuesByObject[TObject["apiSlug"]]')
        parts.push('export type AttioAttributeSlug<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Extract<keyof AttioValuesFor<TObject>, string>')
        parts.push('export type AttioFilterFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = __AttioFilterExpression<AttioRecordValuesFor<TObject>>')
        parts.push('export type AttioRecordFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = __AttioRecordWithValues<AttioRecordValuesFor<TObject>>')
        parts.push('export type AttioQueryRecordsParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; filter?: AttioFilterFor<TObject> | null; limit?: number | null }')
        parts.push('export type AttioUpsertRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; matchingAttribute: AttioAttributeSlug<TObject>; records: AttioValuesFor<TObject>[] }')
        parts.push("export type AttioListObjectsParams = Record<string, never>")
        parts.push('export type AttioQueryRecordsResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Omit<ToolOutputByName["attio_query_records"], "records"> & { records: Array<AttioRecordFor<TObject>> }')
        parts.push('export type AttioUpsertRecordResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Omit<ToolOutputByName["attio_upsert_record"], "records"> & { records?: Array<AttioRecordFor<TObject>> }')
        parts.push("")
        parts.push("const __attioMetadataKeys = new Set([")
        parts.push('    "active_from",')
        parts.push('    "active_until",')
        parts.push('    "attribute_type",')
        parts.push('    "created_by_actor",')
        parts.push("])")
        parts.push("")
        parts.push("const __attioMultiValueAttributeSlugsByObject: Record<string, readonly string[]> = {")
        for (const object of attioGeneratedObjects) {
            const multiValueSlugs = object.attributes.filter(isProbablyAttioMultiValue).map(attr => `"${escapeString(attr.api_slug)}"`).join(", ")
            parts.push(`    "${escapeString(object.api_slug)}": [${multiValueSlugs}],`)
        }
        parts.push("}")
        parts.push("")
        parts.push("function __normalizeAttioObjectSlug(object: unknown): string {")
        parts.push('    if (object && typeof object === "object" && "apiSlug" in (object as Record<string, unknown>)) {')
        parts.push('        const apiSlug = (object as { apiSlug?: unknown }).apiSlug')
        parts.push('        if (typeof apiSlug === "string" && apiSlug.length > 0) return apiSlug')
        parts.push("    }")
        parts.push('    return typeof object === "string" ? object : ""')
        parts.push("}")
        parts.push("")
        parts.push("function __serializeAttioFilter(filter: unknown): string | null {")
        parts.push("    if (filter === undefined || filter === null) return null")
        parts.push("    return JSON.stringify(filter)")
        parts.push("}")
        parts.push("")
        parts.push("function __serializeAttioRecords(records: unknown): string {")
        parts.push("    if (!Array.isArray(records)) return JSON.stringify([])")
        parts.push('    return JSON.stringify(records.filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null && !Array.isArray(record)))')
        parts.push("}")
        parts.push("")
        parts.push("function __isAttioMultiValueAttribute(objectSlug: string, attributeSlug: string): boolean {")
        parts.push("    return (__attioMultiValueAttributeSlugsByObject[objectSlug] || []).includes(attributeSlug)")
        parts.push("}")
        parts.push("")
        parts.push("function __flattenAttioLeafValue(value: unknown): unknown {")
        parts.push("    if (value === null || value === undefined) return value")
        parts.push("    if (Array.isArray(value)) return value.map(entry => __flattenAttioLeafValue(entry))")
        parts.push('    if (typeof value !== "object") return value')
        parts.push("    const rawObject = value as Record<string, unknown>")
        parts.push('    if (typeof rawObject.full_name === "string") return rawObject.full_name')
        parts.push('    if (typeof rawObject.email_address === "string") return rawObject.email_address')
        parts.push('    if (typeof rawObject.domain === "string") return rawObject.domain')
        parts.push('    if (typeof rawObject.phone_number === "string") return rawObject.phone_number')
        parts.push('    if ("value" in rawObject) return __flattenAttioLeafValue(rawObject.value)')
        parts.push("    const dataEntries = Object.entries(rawObject).filter(([key]) => !__attioMetadataKeys.has(key))")
        parts.push("    if (dataEntries.length === 0) return rawObject")
        parts.push("    if (dataEntries.length === 1) return __flattenAttioLeafValue(dataEntries[0][1])")
        parts.push("    return Object.fromEntries(dataEntries.map(([key, entryValue]) => [key, __flattenAttioLeafValue(entryValue)]))")
        parts.push("}")
        parts.push("")
        parts.push("function __flattenAttioAttributeValue(rawValue: unknown, preferArray: boolean): unknown {")
        parts.push("    if (!Array.isArray(rawValue)) return __flattenAttioLeafValue(rawValue)")
        parts.push("    const flattened = rawValue")
        parts.push("        .map(entry => __flattenAttioLeafValue(entry))")
        parts.push("        .filter(entry => entry !== undefined)")
        parts.push("    return preferArray ? flattened : flattened[0]")
        parts.push("}")
        parts.push("")
        parts.push("function __getAttioRecordValues<TValues extends Record<string, unknown>>(objectSlug: string, record: unknown): TValues {")
        parts.push('    const rawValues = record && typeof record === "object" ? (record as { values?: unknown }).values : undefined')
        parts.push('    if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) return {} as TValues')
        parts.push("    const flattenedValues: Record<string, unknown> = {}")
        parts.push("    for (const [attributeSlug, rawValue] of Object.entries(rawValues)) {")
        parts.push("        flattenedValues[attributeSlug] = __flattenAttioAttributeValue(rawValue, __isAttioMultiValueAttribute(objectSlug, attributeSlug))")
        parts.push("    }")
        parts.push("    return flattenedValues as TValues")
        parts.push("}")
        parts.push("")
        parts.push("function __enhanceAttioRecord<TObject extends GeneratedAttioObject>(object: TObject, record: unknown): __AttioRecordWithValues<AttioRecordValuesFor<TObject>> | undefined {")
        parts.push('    if (!record || typeof record !== "object") return undefined')
        parts.push("    const values = __getAttioRecordValues<AttioRecordValuesFor<TObject>>(__normalizeAttioObjectSlug(object), record)")
        parts.push('    return { ...values, ...(record as __AttioRecordBase), values, attributes: values } as __AttioRecordWithValues<AttioRecordValuesFor<TObject>>')
        parts.push("}")
        parts.push("")
        parts.push('function __enhanceAttioQueryResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_query_records"]): AttioQueryRecordsResult<TObject> {')
        parts.push("    return {")
        parts.push("        ...result,")
        parts.push("        records: (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>,")
        parts.push("    }")
        parts.push("}")
        parts.push("")
        parts.push('function __enhanceAttioUpsertResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_upsert_record"]): AttioUpsertRecordResult<TObject> {')
        parts.push("    return {")
        parts.push("        ...result,")
        parts.push("        records: (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>,")
        parts.push("    }")
        parts.push("}")
        parts.push("")
    }

    // Generate per-tool param types (with integrationId omitted where applicable)
    for (const tool of tools) {
        if (isAttioTool(tool)) continue
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

    const groups: { key: string; integration: string; tools: ToolDefinition[]; integrationId?: string }[] = []

    for (const [integration, integrationTools] of byIntegration) {
        const needsAutoFill = integrationTools.some(hasAutoFillId)

        if (needsAutoFill) {
            const instances = instanceMap.get(integration) || []
            if (instances.length === 0) continue
            groups.push({ key: integration, integration, tools: integrationTools, integrationId: instances[0].id })
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
        parts.push(`function __normalizeGitHubRepos(repo: unknown): string {`)
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
        parts.push(`function __normalizeGitHubReposNames(repositories: unknown): string[] {`)
        parts.push(`    if (!Array.isArray(repositories)) return []`)
        parts.push(`    return repositories.map(repo => __normalizeGitHubRepos(repo))`)
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
            if (group.integration === "attio" && tool.name === "attio_query_records") {
                parts.push(`        ${methodName}<TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>): Promise<AttioQueryRecordsResult<TObject>>`)
            } else if (group.integration === "attio" && tool.name === "attio_upsert_record") {
                parts.push(`        ${methodName}<TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>): Promise<AttioUpsertRecordResult<TObject>>`)
            } else if (group.integration === "attio" && tool.name === "attio_list_objects") {
                parts.push(`        ${methodName}(params?: AttioListObjectsParams): Promise<ToolOutputByName["${escapeString(tool.name)}"]>`)
            } else {
                parts.push(`        ${methodName}(params: ${paramsType}): Promise<ToolOutputByName["${escapeString(tool.name)}"]>`)
            }
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
            const normalizedParamsExpr = group.integration === "github" ? normalizeGitHubReposParams(tool.name) : "params"
            if (group.integration === "attio" && tool.name === "attio_query_records" && group.integrationId) {
                parts.push(`            ${methodName}: <TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>) =>`)
                parts.push(
                    `                agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { objectSlug: __normalizeAttioObjectSlug(params.object), filter: __serializeAttioFilter(params.filter), limit: params.limit ?? null, integrationId: "${escapeString(group.integrationId)}" }).then(result => __enhanceAttioQueryResult(params.object, result)),`
                )
            } else if (group.integration === "attio" && tool.name === "attio_upsert_record" && group.integrationId) {
                parts.push(`            ${methodName}: <TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>) =>`)
                parts.push(
                    `                agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { objectSlug: __normalizeAttioObjectSlug(params.object), matchingAttribute: params.matchingAttribute, records: __serializeAttioRecords(params.records), integrationId: "${escapeString(group.integrationId)}" }).then(result => __enhanceAttioUpsertResult(params.object, result)),`
                )
            } else if (group.integration === "attio" && tool.name === "attio_list_objects" && group.integrationId) {
                parts.push(`            ${methodName}: (params: AttioListObjectsParams = {}) =>`)
                parts.push(
                    `                agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { ...params, integrationId: "${escapeString(group.integrationId)}" }),`
                )
            } else if (group.integrationId && hasAutoFillId(tool)) {
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

function generateSystemSection(tools: ToolDefinition[]): SectionResult {
    const imports = new Set(["TimeTriggerConfig", "TerseConfig", "TypedSkill"])
    const parts: string[] = []
    const skillToolType = buildSkillToolTypeForIntegration(tools, "terse")

    parts.push(sectionHeader("Schedule"))
    parts.push("")
    parts.push("export const Schedule = {")
    parts.push(`    /** Use in \`triggers[]\` — run on a cron schedule */`)
    parts.push("    cron(opts: { expression: string }): TimeTriggerConfig {")
    parts.push("        return new TimeTriggerConfig(opts.expression)")
    parts.push("    },")
    parts.push("}")
    parts.push("")

    parts.push(sectionHeader("Terse"))
    parts.push("")
    parts.push("export const Terse = {")
    parts.push(`    /** Use in \`skills[]\` — built-in web search */`)
    parts.push(`    skill(): TypedSkill<${skillToolType}> {`)
    parts.push(`        return new TerseConfig() as TypedSkill<${skillToolType}>`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Main Codegen Entry Point ──────────────────────────────────────────

export function generateCode(input: CodegenInput): string {
    const allImports = new Set<string>()
    const sections: string[] = []

    const sectionGenerators: SectionResult[] = [
        generateGitHubSection(input.github, input.tools),
        generateGmailSection(input.gmail, input.tools),
        generateSlackSection(input.slack, input.tools),
        generateFigmaSection(input.figma),
        generateLinearSection(input.linear, input.tools),
        generateAtlassianSection(input.atlassian, input.tools),
        generateNotionSection(input.notion, input.tools),
        generatePosthogSection(input.posthog, input.tools),
        generateDatadogSection(input.datadog, input.tools),
        generateLaunchDarklySection(input.launchdarkly, input.tools),
        generateWorkOSSection(input.workos, input.tools),
        generateAttioSection(input.attio, input.tools),
        generateSnowflakeSection(input.snowflake, input.tools),
        generateToolsSection(input.tools, input),
        generateSystemSection(input.tools),
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
