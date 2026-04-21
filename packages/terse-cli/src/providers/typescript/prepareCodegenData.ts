import { toolsWithIntegrationId } from "terse-types"

import type {
    AttioAttributeData,
    AttioInstanceData,
    CodegenInput,
    DatadogInstanceData,
    GitHubInstanceData,
    IntegrationInstanceData,
    LaunchDarklyInstanceData,
    LinearInstanceData,
    NotionInstanceData,
    PosthogInstanceData,
    SlackInstanceData,
    SnowflakeInstanceData,
    ToolDefinition
} from "../codegenTypes.js"

interface ResourceFieldMapping {
    classField: string
    type: string
    sourceField: string
}

type SectionContext<T> = {
    imports: Set<string>
    data?: T
}

export interface ResourceClassContext {
    className: string
    constructorParams: string
    items: Array<{
        staticName: string
        argsText: string
    }>
}

export interface GitHubSectionContext {
    id: string
    skillToolType: string
    owners: Array<{ name: string; staticName: string }>
    repoGroups: Array<{
        ownerStaticName: string
        repos: Array<{
            id: number
            name: string
            fullName: string
            staticName: string
        }>
    }>
}

export interface GmailSectionContext {
    id: string
    skillToolType: string
}

export interface SlackSectionContext {
    id: string
    skillToolType: string
    channelClass: ResourceClassContext
}

export interface LinearSectionContext {
    id: string
    skillToolType: string
    teamClass: ResourceClassContext
    projectClass: ResourceClassContext
}

export interface NotionSectionContext {
    id: string
    skillToolType: string
    databaseClass: ResourceClassContext
    pageClass: ResourceClassContext
}

export interface PosthogSectionContext {
    id: string
    skillToolType: string
    projectClass: ResourceClassContext
}

export interface DatadogSectionContext {
    id: string
    skillToolType: string
    indexClass: ResourceClassContext
}

export interface LaunchDarklySectionContext {
    id: string
    skillToolType: string
    projectClass: ResourceClassContext
}

export interface WorkOSSectionContext {
    id: string
    skillToolType: string
}

export interface AttioObjectContext {
    staticName: string
    apiSlug: string
    singularNoun: string
    attributeSource: string
    recordValuesType: string
    inputValuesType: string
}

export interface AttioSectionContext {
    id: string
    skillToolType: string
    objects: AttioObjectContext[]
}

export interface SnowflakeSectionContext {
    id: string
    skillToolType: string
}

export interface ToolParamTypeContext {
    description?: string
    typeName: string
    tsType: string
}

export interface ToolMethodContext {
    description?: string
    generatedSignature: string
    runtimeLines: string[]
}

export interface ToolGroupContext {
    key: string
    integrationType: string
    methods: ToolMethodContext[]
}

export interface ToolsSectionContext {
    attioPreludeLines: string[]
    paramTypes: ToolParamTypeContext[]
    githubRepoMappings: Array<{ name: string; fullName: string }>
    groups: ToolGroupContext[]
}

export interface SystemSectionContext {
    skillToolType: string
}

export interface TemplateContext {
    imports: string[]
    useMultilineImports: boolean
    github?: GitHubSectionContext
    gmail?: GmailSectionContext
    slack?: SlackSectionContext
    linear?: LinearSectionContext
    notion?: NotionSectionContext
    posthog?: PosthogSectionContext
    datadog?: DatadogSectionContext
    launchdarkly?: LaunchDarklySectionContext
    workos?: WorkOSSectionContext
    attio?: AttioSectionContext
    snowflake?: SnowflakeSectionContext
    tools?: ToolsSectionContext
    system: SystemSectionContext
}

export function toPascalCase(value: string): string {
    return value
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
}

export function escapeString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function toGeneratedIdentifier(raw: string, fallback: string): string {
    let name = toPascalCase(raw || fallback)
    if (!name) name = fallback
    if (/^\d/.test(name)) name = `_${name}`
    return name
}

function toCamelCase(value: string): string {
    const pascal = toPascalCase(value)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function toolNameToInterfaceName(name: string): string {
    return (
        name
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join("") + "Params"
    )
}

function buildResourceClassContext(className: string, fields: ResourceFieldMapping[], staticNameField: string, items: object[]): ResourceClassContext {
    const constructorParams = fields.map(field => `public readonly ${field.classField}: ${field.type}`).join(", ")

    const entries: ResourceClassContext["items"] = []
    const usedNames = new Set<string>()

    for (const item of items) {
        const source = item as Record<string, unknown>
        let name = toPascalCase(String(source[staticNameField] || "Unknown"))
        if (!name || /^\d/.test(name)) name = `_${name}`
        while (usedNames.has(name)) name += "_"
        usedNames.add(name)

        const argsText = fields
            .map(field => {
                const value = source[field.sourceField]
                if (typeof value === "number") return String(value)
                return `"${escapeString(String(value ?? ""))}"`
            })
            .join(", ")

        entries.push({
            staticName: name,
            argsText
        })
    }

    return {
        className,
        constructorParams,
        items: entries
    }
}

function sectionData<T>(imports: string[], data?: T): SectionContext<T> {
    return { imports: new Set(imports), data }
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

export function attioAttributeBaseType(attr: AttioAttributeData): string {
    const slug = (attr.api_slug || "").toLowerCase()
    const type = (attr.type || "").toLowerCase()

    if (type.includes("checkbox") || type.includes("boolean")) return "boolean"
    if (type.includes("number") || type.includes("currency") || type.includes("rating") || type.includes("percent")) {
        return "number"
    }
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
    if (type.includes("location") || type.includes("address") || type.includes("reference") || type.includes("record") || type.includes("actor")) {
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
    return baseType.includes("|") ? `(${baseType})[]` : `${baseType}[]`
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

function toolIntegrationToIntegrationType(toolIntegration: string): string {
    return toolIntegration
}

function renderStringLiteralUnion(values: string[]): string {
    if (values.length === 0) return "never"
    return values.map(value => `"${escapeString(value)}"`).join(" | ")
}

export function buildSkillToolTypeForIntegration(tools: ToolDefinition[], integrationType: string): string {
    const toolNames = tools
        .filter(tool => toolIntegrationToIntegrationType(tool.integration.toLowerCase()) === integrationType)
        .filter(tool => !tool.isReadOnly || tool.supportsApproval)
        .map(tool => tool.name)
        .sort()

    return renderStringLiteralUnion(toolNames)
}

function prepareGitHubSection(instances: GitHubInstanceData[], tools: ToolDefinition[]): SectionContext<GitHubSectionContext> {
    if (instances.length === 0) return sectionData([])

    const inst = instances[0]
    const imports = [
        "GitHubConfig",
        "GitHubEventType",
        "TypedTrigger",
        "TypedSkill",
        "GithubPROpenedTrigger",
        "GithubPRMergedTrigger",
        "GithubPRClosedTrigger",
        "GithubPRSynchronizedTrigger",
        "GithubPRTrigger",
        "GithubPushTrigger",
        "GithubTrigger"
    ]
    const skillToolType = buildSkillToolTypeForIntegration(tools, "github")

    const repositoriesWithFullName = inst.repositories.map(repo => {
        const owner = repo.owner || "UnknownOwner"
        const fullName = repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name
        return { ...repo, owner, fullName }
    })

    const ownerEntries = new Map<string, { staticName: string; repos: typeof repositoriesWithFullName }>()
    const usedOwnerNames = new Set<string>()
    for (const repo of repositoriesWithFullName) {
        if (!ownerEntries.has(repo.owner)) {
            let ownerStaticName = toGeneratedIdentifier(repo.owner, "UnknownOwner")
            while (usedOwnerNames.has(ownerStaticName)) ownerStaticName += "_"
            usedOwnerNames.add(ownerStaticName)
            ownerEntries.set(repo.owner, { staticName: ownerStaticName, repos: [] as typeof repositoriesWithFullName })
        }
        ownerEntries.get(repo.owner)!.repos.push(repo)
    }

    const owners = Array.from(ownerEntries.entries()).map(([name, data]) => ({
        name,
        staticName: data.staticName
    }))

    const repoGroups = Array.from(ownerEntries.values()).map(group => {
        const usedRepoNames = new Set<string>()
        return {
            ownerStaticName: group.staticName,
            repos: group.repos.map(repo => {
                let staticName = toGeneratedIdentifier(repo.name, "Repos")
                while (usedRepoNames.has(staticName)) staticName += "_"
                usedRepoNames.add(staticName)
                return {
                    id: repo.id,
                    name: repo.name,
                    fullName: repo.fullName,
                    staticName
                }
            })
        }
    })

    return sectionData(imports, {
        id: inst.integration.id,
        skillToolType,
        owners,
        repoGroups
    })
}

function prepareGmailSection(instances: IntegrationInstanceData[], tools: ToolDefinition[]): SectionContext<GmailSectionContext> {
    if (instances.length === 0) return sectionData([])
    return sectionData(["GmailConfig", "GmailOutputConfig", "GmailDraftOutputConfig", "TypedSkill", "TypedTrigger", "GmailEventType", "GmailTrigger"], {
        id: instances[0].id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "gmail")
    })
}

function prepareSlackSection(instances: SlackInstanceData[], tools: ToolDefinition[]): SectionContext<SlackSectionContext> {
    if (instances.length === 0) return sectionData([])
    const inst = instances[0]
    return sectionData(
        ["SlackAppMentionTrigger", "SlackConfig", "SlackMessageTrigger", "SlackOutputConfig", "SlackReactionAddedTrigger", "TypedSkill", "SlackEventType", "TypedTrigger", "SlackTrigger"],
        {
            id: inst.id,
            skillToolType: buildSkillToolTypeForIntegration(tools, "slack"),
            channelClass: buildResourceClassContext(
                "SlackChannel",
                [
                    { classField: "channelId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.channels
            )
        }
    )
}

function prepareLinearSection(instances: LinearInstanceData[], tools: ToolDefinition[]): SectionContext<LinearSectionContext> {
    if (instances.length === 0) return sectionData([])
    const inst = instances[0]
    return sectionData(
        [
            "LinearInputConfig",
            "LinearOutputConfig",
            "TypedSkill",
            "TypedTrigger",
            "LinearEventType",
            "LinearIssueCreatedTrigger",
            "LinearIssueUpdatedTrigger",
            "LinearCommentCreatedTrigger",
            "LinearTrigger"
        ],
        {
            id: inst.id,
            skillToolType: buildSkillToolTypeForIntegration(tools, "linear"),
            teamClass: buildResourceClassContext(
                "LinearTeam",
                [
                    { classField: "teamId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" },
                    { classField: "key", type: "string", sourceField: "key" }
                ],
                "name",
                inst.teams
            ),
            projectClass: buildResourceClassContext(
                "LinearProject",
                [
                    { classField: "projectId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.projects
            )
        }
    )
}

function prepareNotionSection(instances: NotionInstanceData[], tools: ToolDefinition[]): SectionContext<NotionSectionContext> {
    if (instances.length === 0) return sectionData([])
    const inst = instances[0]
    return sectionData(["NotionConfig", "TypedSkill"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "notion"),
        databaseClass: buildResourceClassContext(
            "NotionDatabase",
            [
                { classField: "databaseId", type: "string", sourceField: "id" },
                { classField: "title", type: "string", sourceField: "title" }
            ],
            "title",
            inst.databases
        ),
        pageClass: buildResourceClassContext(
            "NotionPage",
            [
                { classField: "pageId", type: "string", sourceField: "id" },
                { classField: "title", type: "string", sourceField: "title" }
            ],
            "title",
            inst.pages
        )
    })
}

function preparePosthogSection(instances: PosthogInstanceData[], tools: ToolDefinition[]): SectionContext<PosthogSectionContext> {
    if (instances.length === 0) return sectionData([])
    const inst = instances[0]
    return sectionData(["PosthogConfig", "TypedSkill"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "posthog"),
        projectClass: buildResourceClassContext(
            "PosthogProject",
            [
                { classField: "projectId", type: "string", sourceField: "id" },
                { classField: "name", type: "string", sourceField: "name" }
            ],
            "name",
            inst.projects
        )
    })
}

function prepareDatadogSection(instances: DatadogInstanceData[], tools: ToolDefinition[]): SectionContext<DatadogSectionContext> {
    if (instances.length === 0) return sectionData([])
    const inst = instances[0]
    return sectionData(["DatadogConfig", "TypedSkill"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "datadog"),
        indexClass: buildResourceClassContext("DatadogIndex", [{ classField: "name", type: "string", sourceField: "name" }], "name", inst.indexes)
    })
}

function prepareLaunchDarklySection(instances: LaunchDarklyInstanceData[], tools: ToolDefinition[]): SectionContext<LaunchDarklySectionContext> {
    if (instances.length === 0) return sectionData([])
    const inst = instances[0]
    return sectionData(["LaunchDarklyConfig", "TypedSkill"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "launchdarkly"),
        projectClass: buildResourceClassContext(
            "LaunchDarklyProject",
            [
                { classField: "projectKey", type: "string", sourceField: "key" },
                { classField: "name", type: "string", sourceField: "name" }
            ],
            "name",
            inst.projects
        )
    })
}

function prepareWorkOSSection(instances: IntegrationInstanceData[], tools: ToolDefinition[]): SectionContext<WorkOSSectionContext> {
    if (instances.length === 0) return sectionData([])
    return sectionData(
        [
            "WorkOSInputConfig",
            "WorkOSOutputConfig",
            "WorkOSEventType",
            "TypedSkill",
            "TypedTrigger",
            "WorkOSTrigger",
            "WorkOSUserCreatedTrigger",
            "WorkOSUserUpdatedTrigger",
            "WorkOSUserDeletedTrigger",
            "WorkOSUserTrigger",
            "WorkOSOrganizationMembershipCreatedTrigger",
            "WorkOSOrganizationMembershipUpdatedTrigger",
            "WorkOSOrganizationMembershipDeletedTrigger",
            "WorkOSMembershipTrigger",
            "WorkOSInvitationCreatedTrigger",
            "WorkOSInvitationAcceptedTrigger",
            "WorkOSInvitationResentTrigger",
            "WorkOSInvitationRevokedTrigger",
            "WorkOSInvitationTrigger",
            "WorkOSOrganizationTrigger"
        ],
        {
            id: instances[0].id,
            skillToolType: buildSkillToolTypeForIntegration(tools, "workos")
        }
    )
}

function buildGeneratedAttioObjects(instances: AttioInstanceData[]): Array<AttioObjectContext & { attributes: Array<AttioAttributeData & { api_slug: string }> }> {
    const objects = instances[0]?.objects ?? []
    const usedNames = new Set<string>()

    return objects.map(object => {
        let staticName = toGeneratedIdentifier(object.singular_noun || object.api_slug || "Object", "AttioObject")
        while (usedNames.has(staticName)) staticName += "_"
        usedNames.add(staticName)

        const attributes = (object.attributes || []).filter((attr): attr is Required<Pick<AttioAttributeData, "api_slug">> & AttioAttributeData => !!attr.api_slug)
        const attributeSource =
            attributes.length === 0
                ? "[]"
                : `[\n${attributes
                      .map(attr => {
                          const fields = [
                              `apiSlug: "${escapeString(attr.api_slug)}"`,
                              attr.title ? `title: "${escapeString(attr.title)}"` : undefined,
                              attr.type ? `type: "${escapeString(attr.type)}"` : undefined,
                              attr.is_required !== undefined ? `isRequired: ${attr.is_required ? "true" : "false"}` : undefined,
                              attr.is_unique !== undefined ? `isUnique: ${attr.is_unique ? "true" : "false"}` : undefined
                          ]
                              .filter(Boolean)
                              .join(", ")
                          return `        { ${fields} }`
                      })
                      .join(",\n")}\n    ]`

        return {
            staticName,
            apiSlug: object.api_slug,
            singularNoun: object.singular_noun,
            attributeSource,
            recordValuesType: renderAttioObjectValueShape(attributes, "record"),
            inputValuesType: renderAttioObjectValueShape(attributes, "input"),
            attributes
        }
    })
}

function prepareAttioSection(instances: AttioInstanceData[], tools: ToolDefinition[]): SectionContext<AttioSectionContext> {
    if (instances.length === 0) return sectionData([])
    return sectionData(["AttioOutputConfig", "TypedSkill"], {
        id: instances[0].id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "attio"),
        objects: buildGeneratedAttioObjects(instances)
    })
}

function prepareSnowflakeSection(instances: SnowflakeInstanceData[], tools: ToolDefinition[]): SectionContext<SnowflakeSectionContext> {
    if (instances.length === 0) return sectionData([])
    return sectionData(["SnowflakeOutputConfig", "TypedSkill"], {
        id: instances[0].id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "snowflake")
    })
}

function prepareToolsSection(tools: ToolDefinition[], input: CodegenInput): SectionContext<ToolsSectionContext> {
    if (tools.length === 0) return sectionData([])

    const imports = new Set(["TerseAgent", "ToolInputByName", "ToolOutputByName"])
    const attioPreludeLines: string[] = []

    const instanceMap = new Map<string, { id: string; displayName: string }[]>()
    instanceMap.set(
        "slack",
        input.slack.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "github",
        input.github.map(inst => ({ id: inst.integration.id, displayName: inst.integration.account_name || "" }))
    )
    instanceMap.set(
        "gmail",
        input.gmail.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "linear",
        input.linear.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "notion",
        input.notion.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "posthog",
        input.posthog.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "datadog",
        input.datadog.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "launchdarkly",
        input.launchdarkly.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "workos",
        input.workos.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "attio",
        input.attio.map(inst => ({ id: inst.id, displayName: inst.displayName }))
    )
    instanceMap.set(
        "snowflake",
        input.snowflake.map(inst => ({ id: inst.id, displayName: inst.name }))
    )

    const byIntegration = new Map<string, ToolDefinition[]>()
    for (const tool of tools) {
        const key = tool.integration.toLowerCase()
        if (!byIntegration.has(key)) byIntegration.set(key, [])
        byIntegration.get(key)!.push(tool)
    }

    const hasAutoFillId = (tool: ToolDefinition): boolean => (toolsWithIntegrationId as ReadonlySet<string>).has(tool.name)

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
    const attioGeneratedObjects = buildGeneratedAttioObjects(input.attio)

    if (tools.some(isAttioTool)) {
        attioPreludeLines.push("type __AttioPrimitive = string | number | boolean | null")
        attioPreludeLines.push("type __AttioStructuredValue = Record<string, unknown>")
        attioPreludeLines.push("type __AttioValue = __AttioPrimitive | __AttioStructuredValue | (__AttioPrimitive | __AttioStructuredValue)[]")
        attioPreludeLines.push("type __AttioFilterShorthand<T> = T extends (infer U)[] ? U | T : T")
        attioPreludeLines.push(
            "type __AttioFilterValue<T> = __AttioFilterShorthand<T> | { $eq?: __AttioFilterShorthand<T>; $contains?: string; $starts_with?: string; $ends_with?: string } | Record<string, unknown>"
        )
        attioPreludeLines.push(
            "type __AttioFilterExpression<TValues extends Record<string, unknown>> = Partial<{ [K in keyof TValues]: __AttioFilterValue<TValues[K]> }> & { $and?: Array<__AttioFilterExpression<TValues>>; $or?: Array<__AttioFilterExpression<TValues>> }"
        )
        attioPreludeLines.push('type __AttioRecordBase = NonNullable<NonNullable<ToolOutputByName["attio_upsert_record"]["records"]>[number]>')
        attioPreludeLines.push('type __AttioRecordWithValues<TValues extends Record<string, unknown>> = Omit<__AttioRecordBase, "values"> & TValues & { values: TValues; attributes: TValues }')
        attioPreludeLines.push("")

        if (attioGeneratedObjects.length > 0) {
            attioPreludeLines.push("export type GeneratedAttioObject =")
            for (const object of attioGeneratedObjects) {
                attioPreludeLines.push(`    | typeof AttioObject.${object.staticName}`)
            }
            attioPreludeLines.push("")
            attioPreludeLines.push("export type AttioInputValuesByObject = {")
            for (const object of attioGeneratedObjects) {
                const inputShape = object.attributes.length === 0 ? "Record<string, __AttioValue>" : renderAttioObjectValueShape(object.attributes, "input")
                attioPreludeLines.push(`    "${escapeString(object.apiSlug)}": ${inputShape}`)
            }
            attioPreludeLines.push("}")
            attioPreludeLines.push("")
            attioPreludeLines.push("export type AttioRecordValuesByObject = {")
            for (const object of attioGeneratedObjects) {
                const recordShape = object.attributes.length === 0 ? "Record<string, __AttioValue>" : renderAttioObjectValueShape(object.attributes, "record")
                attioPreludeLines.push(`    "${escapeString(object.apiSlug)}": ${recordShape}`)
            }
            attioPreludeLines.push("}")
            attioPreludeLines.push("")
            attioPreludeLines.push("export type AttioFilterByObject = {")
            for (const object of attioGeneratedObjects) {
                attioPreludeLines.push(`    "${escapeString(object.apiSlug)}": __AttioFilterExpression<AttioRecordValuesByObject["${escapeString(object.apiSlug)}"]>`)
            }
            attioPreludeLines.push("}")
            attioPreludeLines.push("")
            attioPreludeLines.push("export type AttioRecordByObject = {")
            for (const object of attioGeneratedObjects) {
                attioPreludeLines.push(`    "${escapeString(object.apiSlug)}": __AttioRecordWithValues<AttioRecordValuesByObject["${escapeString(object.apiSlug)}"]>`)
            }
            attioPreludeLines.push("}")
        } else {
            attioPreludeLines.push("export type GeneratedAttioObject = AttioObject<string, Record<string, __AttioValue>, Record<string, __AttioValue>>")
            attioPreludeLines.push("export type AttioInputValuesByObject = Record<string, Record<string, __AttioValue>>")
            attioPreludeLines.push("export type AttioRecordValuesByObject = Record<string, Record<string, __AttioValue>>")
            attioPreludeLines.push("export type AttioFilterByObject = Record<string, __AttioFilterExpression<Record<string, __AttioValue>>>")
            attioPreludeLines.push("export type AttioRecordByObject = Record<string, __AttioRecordWithValues<Record<string, __AttioValue>>>")
        }

        attioPreludeLines.push("")
        attioPreludeLines.push(
            'export type AttioValuesFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = TObject extends { __inputValues: infer TInputValues } ? TInputValues : AttioInputValuesByObject[TObject["apiSlug"]]'
        )
        attioPreludeLines.push(
            'export type AttioRecordValuesFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = TObject extends { __recordValues: infer TRecordValues } ? TRecordValues : AttioRecordValuesByObject[TObject["apiSlug"]]'
        )
        attioPreludeLines.push("export type AttioAttributeSlug<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Extract<keyof AttioValuesFor<TObject>, string>")
        attioPreludeLines.push("export type AttioFilterFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = __AttioFilterExpression<AttioRecordValuesFor<TObject>>")
        attioPreludeLines.push("export type AttioRecordFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = __AttioRecordWithValues<AttioRecordValuesFor<TObject>>")
        attioPreludeLines.push(
            "export type AttioQueryRecordsParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; filter?: AttioFilterFor<TObject> | null; limit?: number | null }"
        )
        attioPreludeLines.push(
            "export type AttioUpsertRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; matchingAttribute: AttioAttributeSlug<TObject>; records: AttioValuesFor<TObject>[] }"
        )
        attioPreludeLines.push("export type AttioListObjectsParams = Record<string, never>")
        attioPreludeLines.push(
            'export type AttioQueryRecordsResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Omit<ToolOutputByName["attio_query_records"], "records"> & { records: Array<AttioRecordFor<TObject>> }'
        )
        attioPreludeLines.push(
            'export type AttioUpsertRecordResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Omit<ToolOutputByName["attio_upsert_record"], "records"> & { records?: Array<AttioRecordFor<TObject>> }'
        )
        attioPreludeLines.push("")
        attioPreludeLines.push("const __attioMetadataKeys = new Set([")
        attioPreludeLines.push('    "active_from",')
        attioPreludeLines.push('    "active_until",')
        attioPreludeLines.push('    "attribute_type",')
        attioPreludeLines.push('    "created_by_actor",')
        attioPreludeLines.push("])")
        attioPreludeLines.push("")
        attioPreludeLines.push("const __attioMultiValueAttributeSlugsByObject: Record<string, readonly string[]> = {")
        for (const object of attioGeneratedObjects) {
            const multiValueSlugs = object.attributes
                .filter(isProbablyAttioMultiValue)
                .map(attr => `"${escapeString(attr.api_slug)}"`)
                .join(", ")
            attioPreludeLines.push(`    "${escapeString(object.apiSlug)}": [${multiValueSlugs}],`)
        }
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __normalizeAttioObjectSlug(object: unknown): string {")
        attioPreludeLines.push('    if (object && typeof object === "object" && "apiSlug" in (object as Record<string, unknown>)) {')
        attioPreludeLines.push("        const apiSlug = (object as { apiSlug?: unknown }).apiSlug")
        attioPreludeLines.push('        if (typeof apiSlug === "string" && apiSlug.length > 0) return apiSlug')
        attioPreludeLines.push("    }")
        attioPreludeLines.push('    return typeof object === "string" ? object : ""')
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __serializeAttioFilter(filter: unknown): string | null {")
        attioPreludeLines.push("    if (filter === undefined || filter === null) return null")
        attioPreludeLines.push("    return JSON.stringify(filter)")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __serializeAttioRecords(records: unknown): string {")
        attioPreludeLines.push("    if (!Array.isArray(records)) return JSON.stringify([])")
        attioPreludeLines.push('    return JSON.stringify(records.filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null && !Array.isArray(record)))')
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __isAttioMultiValueAttribute(objectSlug: string, attributeSlug: string): boolean {")
        attioPreludeLines.push("    return (__attioMultiValueAttributeSlugsByObject[objectSlug] || []).includes(attributeSlug)")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __flattenAttioLeafValue(value: unknown): unknown {")
        attioPreludeLines.push("    if (value === null || value === undefined) return value")
        attioPreludeLines.push("    if (Array.isArray(value)) return value.map(entry => __flattenAttioLeafValue(entry))")
        attioPreludeLines.push('    if (typeof value !== "object") return value')
        attioPreludeLines.push("    const rawObject = value as Record<string, unknown>")
        attioPreludeLines.push('    if (typeof rawObject.full_name === "string") return rawObject.full_name')
        attioPreludeLines.push('    if (typeof rawObject.email_address === "string") return rawObject.email_address')
        attioPreludeLines.push('    if (typeof rawObject.domain === "string") return rawObject.domain')
        attioPreludeLines.push('    if (typeof rawObject.phone_number === "string") return rawObject.phone_number')
        attioPreludeLines.push('    if ("value" in rawObject) return __flattenAttioLeafValue(rawObject.value)')
        attioPreludeLines.push("    const dataEntries = Object.entries(rawObject).filter(([key]) => !__attioMetadataKeys.has(key))")
        attioPreludeLines.push("    if (dataEntries.length === 0) return rawObject")
        attioPreludeLines.push("    if (dataEntries.length === 1) return __flattenAttioLeafValue(dataEntries[0][1])")
        attioPreludeLines.push("    return Object.fromEntries(dataEntries.map(([key, entryValue]) => [key, __flattenAttioLeafValue(entryValue)]))")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __flattenAttioAttributeValue(rawValue: unknown, preferArray: boolean): unknown {")
        attioPreludeLines.push("    if (!Array.isArray(rawValue)) return __flattenAttioLeafValue(rawValue)")
        attioPreludeLines.push("    const flattened = rawValue")
        attioPreludeLines.push("        .map(entry => __flattenAttioLeafValue(entry))")
        attioPreludeLines.push("        .filter(entry => entry !== undefined)")
        attioPreludeLines.push("    return preferArray ? flattened : flattened[0]")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __getAttioRecordValues<TValues extends Record<string, unknown>>(objectSlug: string, record: unknown): TValues {")
        attioPreludeLines.push('    const rawValues = record && typeof record === "object" ? (record as { values?: unknown }).values : undefined')
        attioPreludeLines.push('    if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) return {} as TValues')
        attioPreludeLines.push("    const flattenedValues: Record<string, unknown> = {}")
        attioPreludeLines.push("    for (const [attributeSlug, rawValue] of Object.entries(rawValues)) {")
        attioPreludeLines.push("        flattenedValues[attributeSlug] = __flattenAttioAttributeValue(rawValue, __isAttioMultiValueAttribute(objectSlug, attributeSlug))")
        attioPreludeLines.push("    }")
        attioPreludeLines.push("    return flattenedValues as TValues")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push(
            "function __enhanceAttioRecord<TObject extends GeneratedAttioObject>(object: TObject, record: unknown): __AttioRecordWithValues<AttioRecordValuesFor<TObject>> | undefined {"
        )
        attioPreludeLines.push('    if (!record || typeof record !== "object") return undefined')
        attioPreludeLines.push("    const values = __getAttioRecordValues<AttioRecordValuesFor<TObject>>(__normalizeAttioObjectSlug(object), record)")
        attioPreludeLines.push("    return { ...values, ...(record as __AttioRecordBase), values, attributes: values } as __AttioRecordWithValues<AttioRecordValuesFor<TObject>>")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push(
            'function __enhanceAttioQueryResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_query_records"]): AttioQueryRecordsResult<TObject> {'
        )
        attioPreludeLines.push("    return {")
        attioPreludeLines.push("        ...result,")
        attioPreludeLines.push("        records: (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>,")
        attioPreludeLines.push("    }")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push(
            'function __enhanceAttioUpsertResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_upsert_record"]): AttioUpsertRecordResult<TObject> {'
        )
        attioPreludeLines.push("    return {")
        attioPreludeLines.push("        ...result,")
        attioPreludeLines.push("        records: (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>,")
        attioPreludeLines.push("    }")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
    }

    const paramTypes: ToolParamTypeContext[] = []
    for (const tool of tools) {
        if (isAttioTool(tool)) continue
        const key = `"${escapeString(tool.name)}"`
        const tsType = hasAutoFillId(tool) ? `Omit<ToolInputByName[${key}], "integrationId">` : `ToolInputByName[${key}]`
        paramTypes.push({
            description: tool.description || undefined,
            typeName: toolNameToInterfaceName(tool.name),
            tsType
        })
    }

    const rawGroups: Array<{ key: string; integration: string; tools: ToolDefinition[]; integrationId?: string }> = []
    for (const [integration, integrationTools] of byIntegration.entries()) {
        const needsAutoFill = integrationTools.some(hasAutoFillId)
        if (needsAutoFill) {
            const instances = instanceMap.get(integration) || []
            if (instances.length === 0) continue
            rawGroups.push({ key: integration, integration, tools: integrationTools, integrationId: instances[0].id })
        } else {
            rawGroups.push({ key: integration, integration, tools: integrationTools })
        }
    }
    rawGroups.sort((a, b) => a.key.localeCompare(b.key))

    const githubRepoMappings: Array<{ name: string; fullName: string }> = []
    if (rawGroups.some(group => group.integration === "github")) {
        const githubRepoFullNames = Array.from(
            new Set(input.github.flatMap(inst => inst.repositories.map(repo => (repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name).trim()).filter(Boolean)))
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

        for (const [name, fullName] of Array.from(nameToFullName.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
            githubRepoMappings.push({ name, fullName })
        }
    }

    const groups: ToolGroupContext[] = rawGroups.map(group => ({
        key: group.key,
        integrationType: toolIntegrationToIntegrationType(group.integration),
        methods: group.tools.map(tool => {
            const methodName = toCamelCase(tool.displayName)
            const paramsType = toolNameToInterfaceName(tool.name)
            const normalizedParamsExpr = group.integration === "github" ? normalizeGitHubReposParams(tool.name) : "params"

            let generatedSignature: string
            if (group.integration === "attio" && tool.name === "attio_query_records") {
                generatedSignature = `${methodName}<TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>): Promise<AttioQueryRecordsResult<TObject>>`
            } else if (group.integration === "attio" && tool.name === "attio_upsert_record") {
                generatedSignature = `${methodName}<TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>): Promise<AttioUpsertRecordResult<TObject>>`
            } else if (group.integration === "attio" && tool.name === "attio_list_objects") {
                generatedSignature = `${methodName}(params?: AttioListObjectsParams): Promise<ToolOutputByName["${escapeString(tool.name)}"]>`
            } else {
                generatedSignature = `${methodName}(params: ${paramsType}): Promise<ToolOutputByName["${escapeString(tool.name)}"]>`
            }

            let runtimeLines: string[]
            if (group.integration === "attio" && tool.name === "attio_query_records" && group.integrationId) {
                runtimeLines = [
                    `${methodName}: <TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>) =>`,
                    `    agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { objectSlug: __normalizeAttioObjectSlug(params.object), filter: __serializeAttioFilter(params.filter), limit: params.limit ?? null, integrationId: "${escapeString(group.integrationId)}" }).then(result => __enhanceAttioQueryResult(params.object, result)),`
                ]
            } else if (group.integration === "attio" && tool.name === "attio_upsert_record" && group.integrationId) {
                runtimeLines = [
                    `${methodName}: <TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>) =>`,
                    `    agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { objectSlug: __normalizeAttioObjectSlug(params.object), matchingAttribute: params.matchingAttribute, records: __serializeAttioRecords(params.records), integrationId: "${escapeString(group.integrationId)}" }).then(result => __enhanceAttioUpsertResult(params.object, result)),`
                ]
            } else if (group.integration === "attio" && tool.name === "attio_list_objects" && group.integrationId) {
                runtimeLines = [
                    `${methodName}: (params: AttioListObjectsParams = {}) =>`,
                    `    agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { ...params, integrationId: "${escapeString(group.integrationId)}" }),`
                ]
            } else if (group.integrationId && hasAutoFillId(tool)) {
                runtimeLines = [
                    `${methodName}: (params: ${paramsType}) =>`,
                    `    agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}), integrationId: "${escapeString(group.integrationId)}" }),`
                ]
            } else {
                runtimeLines = [
                    `${methodName}: (params: ${paramsType}) =>`,
                    `    agent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", ${normalizedParamsExpr}),`
                ]
            }

            return {
                description: tool.description || undefined,
                generatedSignature,
                runtimeLines
            }
        })
    }))

    return {
        imports,
        data: {
            attioPreludeLines,
            paramTypes,
            githubRepoMappings,
            groups
        }
    }
}

function prepareSystemSection(tools: ToolDefinition[]): SectionContext<SystemSectionContext> {
    return sectionData(
        [
            "TimeTriggerConfig",
            "TerseConfig",
            "TypedSkill",
            "WebhookInputConfig",
            "WebhookTrigger",
            "CronTrigger",
            "TypedTrigger",
            "WebMonitorConfig",
            "WebMonitorTrigger",
            "WebMonitorTriggerFor",
            "FrequencyUnit",
            "InferStructuredOutput"
        ],
        {
            skillToolType: buildSkillToolTypeForIntegration(tools, "terse")
        }
    )
}

export function prepareTemplateContext(input: CodegenInput): TemplateContext {
    const allImports = new Set<string>()

    const github = prepareGitHubSection(input.github, input.tools)
    const gmail = prepareGmailSection(input.gmail, input.tools)
    const slack = prepareSlackSection(input.slack, input.tools)
    const linear = prepareLinearSection(input.linear, input.tools)
    const notion = prepareNotionSection(input.notion, input.tools)
    const posthog = preparePosthogSection(input.posthog, input.tools)
    const datadog = prepareDatadogSection(input.datadog, input.tools)
    const launchdarkly = prepareLaunchDarklySection(input.launchdarkly, input.tools)
    const workos = prepareWorkOSSection(input.workos, input.tools)
    const attio = prepareAttioSection(input.attio, input.tools)
    const snowflake = prepareSnowflakeSection(input.snowflake, input.tools)
    const tools = prepareToolsSection(input.tools, input)
    const system = prepareSystemSection(input.tools)

    const sections = [github, gmail, slack, linear, notion, posthog, datadog, launchdarkly, workos, attio, snowflake, tools, system]

    for (const section of sections) {
        section.imports.forEach(value => allImports.add(value))
    }

    const imports = [...allImports].sort()

    return {
        imports,
        useMultilineImports: imports.length > 3,
        github: github.data,
        gmail: gmail.data,
        slack: slack.data,
        linear: linear.data,
        notion: notion.data,
        posthog: posthog.data,
        datadog: datadog.data,
        launchdarkly: launchdarkly.data,
        workos: workos.data,
        attio: attio.data,
        snowflake: snowflake.data,
        tools: tools.data,
        system: system.data!
    }
}
