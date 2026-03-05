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

    const inst = instances[0]
    const imports = new Set(["GitHubConfig"])
    const parts: string[] = [sectionHeader("GitHub"), ""]
    const id = inst.integration.id

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

    // Namespace object with typed event triggers
    parts.push("export const GitHub = {")
    parts.push(`    /** Trigger on push to a repository */`)
    parts.push(`    onPush(opts: { repo: Repos }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PUSH])`)
    parts.push("    },")
    parts.push(`    /** Trigger when a pull request is opened */`)
    parts.push(`    onPROpened(opts: { repo: Repos }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_OPENED])`)
    parts.push("    },")
    parts.push(`    /** Trigger when a pull request is merged */`)
    parts.push(`    onPRMerged(opts: { repo: Repos }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_MERGED])`)
    parts.push("    },")
    parts.push(`    /** Trigger when a pull request is closed */`)
    parts.push(`    onPRClosed(opts: { repo: Repos }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_CLOSED])`)
    parts.push("    },")
    parts.push(`    /** Trigger on any pull request event */`)
    parts.push(`    onPR(opts: { repo: Repos }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", [opts.repo.repositoryId], [GitHubEventType.PR_OPENED, GitHubEventType.PR_MERGED, GitHubEventType.PR_CLOSED, GitHubEventType.PR_SYNCHRONIZE])`)
    parts.push("    },")
    parts.push(`    /** Trigger on specific GitHub events for the given repositories */`)
    parts.push(`    trigger(opts: { repos: Repos[]; eventTypes?: GitHubEventType[] }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", opts.repos.map(r => r.repositoryId), opts.eventTypes)`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { repos: Repos[] }): GitHubConfig {`)
    parts.push(`        return new GitHubConfig("${id}", opts.repos.map(r => r.repositoryId))`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Gmail ─────────────────────────────────────────────────────────────

function generateGmailSection(instances: IntegrationInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["GmailConfig", "GmailOutputConfig", "GmailDraftOutputConfig"])
    const parts: string[] = [sectionHeader("Gmail"), ""]
    const id = instances[0].id

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
    parts.push(`    skill(): GmailOutputConfig {`)
    parts.push(`        return new GmailOutputConfig("${id}")`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` — creates draft emails */`)
    parts.push(`    draftSkill(): GmailDraftOutputConfig {`)
    parts.push(`        return new GmailDraftOutputConfig("${id}")`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Slack ──────────────────────────────────────────────────────────────

function generateSlackSection(instances: SlackInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["SlackConfig", "SlackOutputConfig"])
    const parts: string[] = [sectionHeader("Slack"), ""]
    const id = inst.id

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
    parts.push(`    skill(opts?: { channel?: SlackChannel; userIds?: string[]; userNames?: string[]; listenToUserDms?: boolean }): SlackOutputConfig {`)
    parts.push(`        return new SlackOutputConfig("${id}", opts?.channel?.channelId, opts?.channel?.name, opts?.userIds, opts?.userNames, opts?.listenToUserDms)`)
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

function generateLinearSection(instances: LinearInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["LinearInputConfig", "LinearOutputConfig"])
    const parts: string[] = [sectionHeader("Linear"), ""]
    const id = inst.id

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
    parts.push(`    skill(opts?: { team?: LinearTeam; projectId?: string; projectName?: string }): LinearOutputConfig {`)
    parts.push(`        return new LinearOutputConfig("${id}", opts?.team?.teamId, opts?.team?.name, opts?.projectId, opts?.projectName)`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Jira & Confluence (Atlassian) ─────────────────────────────────────

function generateAtlassianSection(instances: AtlassianInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["JiraConfig", "ConfluenceConfig"])
    const parts: string[] = [sectionHeader("Jira & Confluence"), ""]
    const id = inst.id

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
    parts.push(`    skill(opts?: { project?: JiraProject }): JiraConfig {`)
    parts.push(`        return new JiraConfig("${id}", opts?.project?.projectKey, opts?.project?.projectId)`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    parts.push("export const Confluence = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { page: ConfluencePage }): ConfluenceConfig {`)
    parts.push(`        return new ConfluenceConfig("${id}", opts.page.spaceName, opts.page.spaceId, opts.page.pageId, opts.page.title)`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Notion ────────────────────────────────────────────────────────────

function generateNotionSection(instances: NotionInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["NotionConfig"])
    const parts: string[] = [sectionHeader("Notion"), ""]
    const id = inst.id

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
    parts.push(`    skill(opts?: { databases?: NotionDatabase[]; pages?: NotionPage[] }): NotionConfig {`)
    parts.push(`        return new NotionConfig("${id}",`)
    parts.push(`            opts?.databases?.map(d => d.databaseId), opts?.databases?.map(d => d.title),`)
    parts.push(`            opts?.pages?.map(p => p.pageId), opts?.pages?.map(p => p.title))`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── PostHog ───────────────────────────────────────────────────────────

function generatePosthogSection(instances: PosthogInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["PosthogConfig"])
    const parts: string[] = [sectionHeader("PostHog"), ""]
    const id = inst.id

    parts.push(generateResourceClass("PosthogProject", [
        { classField: "projectId", type: "string", sourceField: "id" },
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.projects))
    parts.push("")

    parts.push("export const Posthog = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { project: PosthogProject }): PosthogConfig {`)
    parts.push(`        return new PosthogConfig("${id}", opts.project.projectId, opts.project.name)`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Datadog ───────────────────────────────────────────────────────────

function generateDatadogSection(instances: DatadogInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["DatadogConfig"])
    const parts: string[] = [sectionHeader("Datadog"), ""]
    const id = inst.id

    parts.push(generateResourceClass("DatadogIndex", [
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.indexes))
    parts.push("")

    parts.push("export const Datadog = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { indexes?: DatadogIndex[] }): DatadogConfig {`)
    parts.push(`        return new DatadogConfig("${id}", opts?.indexes?.map(i => i.name))`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── LaunchDarkly ──────────────────────────────────────────────────────

function generateLaunchDarklySection(instances: LaunchDarklyInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["LaunchDarklyConfig"])
    const parts: string[] = [sectionHeader("LaunchDarkly"), ""]
    const id = inst.id

    parts.push(generateResourceClass("LaunchDarklyProject", [
        { classField: "projectKey", type: "string", sourceField: "key" },
        { classField: "name", type: "string", sourceField: "name" },
    ], "name", inst.projects))
    parts.push("")

    parts.push("export const LaunchDarkly = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts: { project: LaunchDarklyProject; environmentKeys: string[] }): LaunchDarklyConfig {`)
    parts.push(`        return new LaunchDarklyConfig("${id}", opts.project.projectKey, opts.environmentKeys)`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── WorkOS ────────────────────────────────────────────────────────────

function generateWorkOSSection(instances: IntegrationInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const imports = new Set(["WorkOSInputConfig", "WorkOSOutputConfig"])
    const parts: string[] = [sectionHeader("WorkOS"), ""]
    const id = instances[0].id

    parts.push("export const WorkOS = {")
    parts.push(`    /** Trigger on specific WorkOS event types */`)
    parts.push(`    onEvent(opts: { eventTypes: string[] }): WorkOSInputConfig {`)
    parts.push(`        return new WorkOSInputConfig("${id}", opts.eventTypes)`)
    parts.push("    },")
    parts.push(`    /** Trigger on all WorkOS events */`)
    parts.push(`    trigger(opts?: { eventTypes?: string[] }): WorkOSInputConfig {`)
    parts.push(`        return new WorkOSInputConfig("${id}", opts?.eventTypes)`)
    parts.push("    },")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(): WorkOSOutputConfig {`)
    parts.push(`        return new WorkOSOutputConfig("${id}")`)
    parts.push("    },")
    parts.push("}")
    parts.push("")

    return { code: parts.join("\n"), imports }
}

// ── Attio ─────────────────────────────────────────────────────────────

function generateAttioSection(instances: AttioInstanceData[]): SectionResult {
    if (instances.length === 0) return EMPTY_SECTION

    const inst = instances[0]
    const imports = new Set(["AttioOutputConfig"])
    const parts: string[] = [sectionHeader("Attio"), ""]
    const id = inst.id

    parts.push(generateResourceClass("AttioObject", [
        { classField: "apiSlug", type: "string", sourceField: "api_slug" },
        { classField: "name", type: "string", sourceField: "singular_noun" },
    ], "singular_noun", inst.objects))
    parts.push("")

    parts.push("export const Attio = {")
    parts.push(`    /** Use in \`skills[]\` */`)
    parts.push(`    skill(opts?: { object?: AttioObject }): AttioOutputConfig {`)
    parts.push(`        return new AttioOutputConfig("${id}", opts?.object?.apiSlug)`)
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
            const normalizedParamsExpr = group.integration === "github" ? normalizeGitHubReposParams(tool.name) : "params"
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
    parts.push("    skill(): TerseConfig {")
    parts.push("        return new TerseConfig()")
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
