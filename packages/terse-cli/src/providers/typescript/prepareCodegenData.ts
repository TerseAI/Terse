import { IntegrationType, type ToolDefinition, ToolDefinitions, type ToolName, toolsWithIntegrationId } from "terse-types"
import { z } from "zod"

import type {
    AttioAttributeData,
    AttioInstanceData,
    CodegenInput,
    DatadogInstanceData,
    GitHubInstanceData,
    HeyReachInstanceData,
    IntegrationInstanceData,
    LaunchDarklyInstanceData,
    LinearInstanceData,
    NotionInstanceData,
    PosthogInstanceData,
    ResendInstanceData,
    SlackInstanceData,
    SnowflakeInstanceData
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

interface ResourceClassContext {
    className: string
    constructorParams: string
    items: Array<{
        staticName: string
        argsText: string
    }>
}

interface GitHubSectionContext {
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

interface GmailSectionContext {
    id: string
    skillToolType: string
}

interface SlackSectionContext {
    id: string
    skillToolType: string
    channelClass: ResourceClassContext
    userClass: ResourceClassContext
}

interface LinearSectionContext {
    id: string
    skillToolType: string
    teamClass: ResourceClassContext
    projectClass: ResourceClassContext
}

interface NotionSectionContext {
    id: string
    skillToolType: string
    databaseClass: ResourceClassContext
    pageClass: ResourceClassContext
}

interface PosthogSectionContext {
    id: string
    skillToolType: string
    projectClass: ResourceClassContext
    eventNames: string[]
}

interface DatadogSectionContext {
    id: string
    skillToolType: string
    indexClass: ResourceClassContext
}

interface LaunchDarklySectionContext {
    id: string
    skillToolType: string
    projectClass: ResourceClassContext
}

interface WorkOSSectionContext {
    id: string
    skillToolType: string
}

interface AttioObjectContext {
    staticName: string
    apiSlug: string
    objectId: string
    singularNoun: string
    attributeSource: string
    recordValuesType: string
    inputValuesType: string
}

interface AttioSectionContext {
    id: string
    skillToolType: string
    objects: AttioObjectContext[]
    lists: AttioListContext[]
    valueTypeLines: string[]
    runtimeLines: string[]
}

interface AttioListContext {
    staticName: string
    apiSlug: string
    name: string
    listId: string
    parentObject: string
    entryValuesType: string
    entryRecordValuesType: string
    attributeSource: string
}

interface SnowflakeSectionContext {
    id: string
    skillToolType: string
}

interface HeyReachSectionContext {
    id: string
    campaignClass: ResourceClassContext
}

interface ResendSectionContext {
    id: string
    skillToolType: string
    templates: Array<{
        staticName: string
        id: string
        alias: string | null
        name: string
        variablesType: string
        variablesMetadata: string
    }>
}

interface ToolParamTypeContext {
    description?: string
    typeName: string
    tsType: string
}

interface ToolMethodContext {
    description?: string
    generatedSignature: string
    runtimeLines: string[]
}

interface ToolGroupContext {
    key: string
    integrationType: string
    methods: ToolMethodContext[]
}

interface ToolsSectionContext {
    attioPreludeLines: string[]
    paramTypes: ToolParamTypeContext[]
    githubRepoMappings: Array<{ name: string; fullName: string }>
    groups: ToolGroupContext[]
}

interface SystemSectionContext {}

export interface TemplateContext {
    imports: string[]
    useMultilineImports: boolean
    availableIntegrations?: string
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
    heyreach?: HeyReachSectionContext
    resend?: ResendSectionContext
    tools?: ToolsSectionContext
    system: SystemSectionContext
}

function toPascalCase(value: string): string {
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

function toGeneratedIdentifier(raw: string, fallback: string): string {
    let name = toPascalCase(raw || fallback)
    if (!name) name = fallback
    if (/^\d/.test(name)) name = `_${name}`
    return name
}

export function toCamelCase(value: string): string {
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

function attioAttributeBaseType(attr: AttioAttributeData): string {
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

function attioValueTypeLines(
    objects: Array<{ staticName: string; attributes: Array<AttioAttributeData & { api_slug: string }> }> = [],
    lists: Array<{ staticName: string; attributes: Array<AttioAttributeData & { api_slug: string }> }> = []
): string[] {
    const lines = [
        "export type AttioSelectOption = {",
        "    id: string",
        "    title: string",
        "    is_archived: boolean",
        "}",
        "",
        'export type AttioActorReferenceInput = string | { workspace_member_email_address: string } | { referenced_actor_type: "workspace-member"; referenced_actor_id: string }',
        "export type AttioRecordReferenceInput = { target_object: string; target_record_id: string } | Record<string, unknown>",
        "export type AttioActorReference = { referenced_actor_type: string; referenced_actor_id: string | null }",
        "export type AttioRecordReferenceValue = { target_object: string; target_record_id: string }",
        "export type AttioCurrencyValue = { currency_value: number; currency_code: string | null }"
    ]

    const usedConstNames = new Set<string>()
    for (const object of [...objects, ...lists]) {
        for (const attr of object.attributes) {
            if (!attr.options || attr.options.length === 0) continue
            let attrName = toGeneratedIdentifier(attr.title || attr.api_slug, "Attribute")
            if (attrName.startsWith(object.staticName) && attrName.length > object.staticName.length) {
                attrName = attrName.slice(object.staticName.length)
            }
            let constName = `Attio${object.staticName}${attrName}`
            while (usedConstNames.has(constName)) constName += "_"
            usedConstNames.add(constName)
            lines.push("", `export const ${constName} = {`)
            const usedKeys = new Set<string>()
            for (const title of attr.options) {
                let key = toGeneratedIdentifier(title, "Option")
                while (usedKeys.has(key)) key += "_"
                usedKeys.add(key)
                lines.push(`    ${key}: "${escapeString(title)}",`)
            }
            lines.push("} as const")
        }
    }

    return lines
}

function attioIsMultiValue(attr: AttioAttributeData): boolean {
    if (typeof attr.is_multiselect === "boolean") return attr.is_multiselect
    return isProbablyAttioMultiValue(attr)
}

function attioAttributeInputBaseType(attr: AttioAttributeData): string {
    const type = (attr.type || "").toLowerCase()

    if (type.includes("actor")) return "AttioActorReferenceInput"
    if (type.includes("record") && type.includes("reference")) return "AttioRecordReferenceInput"
    if ((type.includes("select") || type.includes("status")) && attr.options && attr.options.length > 0) {
        return renderStringLiteralUnion(attr.options)
    }
    return attioAttributeBaseType(attr)
}

function attioAttributeRecordBaseType(attr: AttioAttributeData): string {
    const type = (attr.type || "").toLowerCase()

    if (type.includes("select") || type.includes("status")) return "AttioSelectOption"
    if (type.includes("actor")) return "AttioActorReference"
    if (type.includes("record") && type.includes("reference")) return "AttioRecordReferenceValue"
    if (type.includes("currency")) return "AttioCurrencyValue"
    return attioAttributeBaseType(attr)
}

function attioAttributeInputTsType(attr: AttioAttributeData): string {
    const baseType = attioAttributeInputBaseType(attr)
    if (!attioIsMultiValue(attr)) return baseType
    return baseType.includes("|") ? `(${baseType})[]` : `${baseType}[]`
}

function attioAttributeRecordTsType(attr: AttioAttributeData): string {
    const baseType = attioAttributeRecordBaseType(attr)
    if (!attioIsMultiValue(attr)) return baseType
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

function buildSkillToolTypeForIntegration(tools: ToolDefinition[], integrationType: string): string {
    const toolNames = tools
        .filter(tool => toolIntegrationToIntegrationType(tool.integration.toLowerCase()) === integrationType)
        .filter(tool => !tool.isReadOnly || tool.supportsApproval)
        .map(tool => tool.name)
        .sort()

    return renderStringLiteralUnion(toolNames)
}

function prepareGitHubSection(inst: GitHubInstanceData | undefined, tools: ToolDefinition[]): SectionContext<GitHubSectionContext> {
    if (!inst) return sectionData([])

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
        "GithubIssueCommentCreatedTrigger",
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

function prepareGmailSection(inst: IntegrationInstanceData | undefined, tools: ToolDefinition[]): SectionContext<GmailSectionContext> {
    if (!inst) return sectionData([])
    return sectionData(["GmailConfig", "GmailOutputConfig", "GmailDraftOutputConfig", "TypedSkill", "TypedTrigger", "GmailEventType", "GmailTrigger"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "gmail")
    })
}

function prepareSlackSection(inst: SlackInstanceData | undefined, tools: ToolDefinition[]): SectionContext<SlackSectionContext> {
    if (!inst) return sectionData([])
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
            ),
            userClass: buildResourceClassContext(
                "SlackUser",
                [
                    { classField: "userId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.users
            )
        }
    )
}

function prepareLinearSection(inst: LinearInstanceData | undefined, tools: ToolDefinition[]): SectionContext<LinearSectionContext> {
    if (!inst) return sectionData([])
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

function prepareNotionSection(inst: NotionInstanceData | undefined, tools: ToolDefinition[]): SectionContext<NotionSectionContext> {
    if (!inst) return sectionData([])
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

function preparePosthogSection(inst: PosthogInstanceData | undefined, tools: ToolDefinition[]): SectionContext<PosthogSectionContext> {
    if (!inst) return sectionData([])
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
        ),
        eventNames: [...new Set(inst.projects.flatMap(project => project.events))]
    })
}

function prepareDatadogSection(inst: DatadogInstanceData | undefined, tools: ToolDefinition[]): SectionContext<DatadogSectionContext> {
    if (!inst) return sectionData([])
    return sectionData(["DatadogConfig", "TypedSkill"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "datadog"),
        indexClass: buildResourceClassContext("DatadogIndex", [{ classField: "name", type: "string", sourceField: "name" }], "name", inst.indexes)
    })
}

function prepareLaunchDarklySection(inst: LaunchDarklyInstanceData | undefined, tools: ToolDefinition[]): SectionContext<LaunchDarklySectionContext> {
    if (!inst) return sectionData([])
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

function prepareWorkOSSection(inst: IntegrationInstanceData | undefined, tools: ToolDefinition[]): SectionContext<WorkOSSectionContext> {
    if (!inst) return sectionData([])
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
            id: inst.id,
            skillToolType: buildSkillToolTypeForIntegration(tools, "workos")
        }
    )
}

function buildGeneratedAttioObjects(inst: AttioInstanceData | undefined): Array<AttioObjectContext & { attributes: Array<AttioAttributeData & { api_slug: string }> }> {
    const objects = inst?.objects ?? []
    const usedNames = new Set<string>()

    return objects.map(object => {
        let staticName = toGeneratedIdentifier(object.singular_noun || object.api_slug || "Object", "AttioObject")
        while (usedNames.has(staticName)) staticName += "_"
        usedNames.add(staticName)

        const attributes = (object.attributes || []).filter((attr): attr is Required<Pick<AttioAttributeData, "api_slug">> & AttioAttributeData => !!attr.api_slug)

        return {
            staticName,
            apiSlug: object.api_slug,
            objectId: object.id.object_id,
            singularNoun: object.singular_noun,
            attributeSource: renderAttioAttributeSource(attributes),
            recordValuesType: renderAttioObjectValueShape(attributes, "record"),
            inputValuesType: renderAttioObjectValueShape(attributes, "input"),
            attributes
        }
    })
}

function buildGeneratedAttioLists(inst: AttioInstanceData | undefined): Array<AttioListContext & { attributes: Array<AttioAttributeData & { api_slug: string }> }> {
    const lists = inst?.lists ?? []
    const usedNames = new Set<string>()

    return lists.map(list => {
        let staticName = toGeneratedIdentifier(list.name || list.api_slug || "List", "AttioList")
        while (usedNames.has(staticName)) staticName += "_"
        usedNames.add(staticName)

        const attributes = (list.attributes || []).filter((attr): attr is Required<Pick<AttioAttributeData, "api_slug">> & AttioAttributeData => !!attr.api_slug)
        const parentObject = Array.isArray(list.parent_object) ? list.parent_object[0] || "" : list.parent_object || ""

        return {
            staticName,
            apiSlug: list.api_slug,
            name: list.name,
            listId: list.id.list_id,
            parentObject,
            attributeSource: renderAttioAttributeSource(attributes),
            entryValuesType: renderAttioObjectValueShape(attributes, "input"),
            entryRecordValuesType: renderAttioObjectValueShape(attributes, "record"),
            attributes
        }
    })
}

function renderAttioAttributeSource(attributes: Array<AttioAttributeData & { api_slug: string }>): string {
    if (attributes.length === 0) return "[]"
    return `[\n${attributes
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
}

function buildAttioRuntimeLines(objects: ReturnType<typeof buildGeneratedAttioObjects>, lists: ReturnType<typeof buildGeneratedAttioLists>): string[] {
    const lines: string[] = []
    lines.push("const __attioMetadataKeys = new Set([")
    lines.push('    "active_from",')
    lines.push('    "active_until",')
    lines.push('    "attribute_type",')
    lines.push('    "created_by_actor",')
    lines.push("])")
    lines.push("")
    lines.push("const __attioMultiValueAttributeSlugsByObject: Record<string, readonly string[]> = {")
    for (const object of objects) {
        const multiValueSlugs = object.attributes
            .filter(attioIsMultiValue)
            .map(attr => `"${escapeString(attr.api_slug)}"`)
            .join(", ")
        lines.push(`    "${escapeString(object.apiSlug)}": [${multiValueSlugs}],`)
    }
    lines.push("}")
    lines.push("")
    lines.push("const __attioObjectSlugByObjectId: Record<string, string> = {")
    for (const object of objects) {
        lines.push(`    "${escapeString(object.objectId)}": "${escapeString(object.apiSlug)}",`)
    }
    lines.push("}")
    lines.push("")
    lines.push("function __flattenAttioLeafValue(value: unknown): unknown {")
    lines.push("    if (value === null || value === undefined) return value")
    lines.push("    if (Array.isArray(value)) return value.map(entry => __flattenAttioLeafValue(entry))")
    lines.push('    if (typeof value !== "object") return value')
    lines.push("    const rawObject = value as Record<string, unknown>")
    lines.push('    if (rawObject.attribute_type === "status") return __toAttioSelectOption(rawObject.status)')
    lines.push('    if (rawObject.attribute_type === "select") return __toAttioSelectOption(rawObject.option)')
    lines.push('    if (typeof rawObject.full_name === "string") return rawObject.full_name')
    lines.push('    if (typeof rawObject.email_address === "string") return rawObject.email_address')
    lines.push('    if (typeof rawObject.domain === "string") return rawObject.domain')
    lines.push('    if (typeof rawObject.phone_number === "string") return rawObject.phone_number')
    lines.push('    if ("value" in rawObject) return __flattenAttioLeafValue(rawObject.value)')
    lines.push("    const dataEntries = Object.entries(rawObject).filter(([key]) => !__attioMetadataKeys.has(key))")
    lines.push("    if (dataEntries.length === 0) return rawObject")
    lines.push("    if (dataEntries.length === 1) return __flattenAttioLeafValue(dataEntries[0][1])")
    lines.push("    return Object.fromEntries(dataEntries.map(([key, entryValue]) => [key, __flattenAttioLeafValue(entryValue)]))")
    lines.push("}")
    lines.push("")
    lines.push("function __toAttioSelectOption(option: unknown): unknown {")
    lines.push('    if (!option || typeof option !== "object") return option')
    lines.push("    const rawOption = option as Record<string, unknown>")
    lines.push('    const rawId = rawOption.id && typeof rawOption.id === "object" ? (rawOption.id as Record<string, unknown>) : undefined')
    lines.push("    const id = rawId?.status_id ?? rawId?.option_id ?? rawOption.id")
    lines.push("    return {")
    lines.push('        id: typeof id === "string" ? id : "",')
    lines.push('        title: typeof rawOption.title === "string" ? rawOption.title : "",')
    lines.push("        is_archived: rawOption.is_archived === true,")
    lines.push("    } satisfies AttioSelectOption")
    lines.push("}")
    lines.push("")
    lines.push("function __flattenAttioAttributeValue(rawValue: unknown, preferArray: boolean): unknown {")
    lines.push("    if (!Array.isArray(rawValue)) return __flattenAttioLeafValue(rawValue)")
    lines.push("    const flattened = rawValue.map(entry => __flattenAttioLeafValue(entry)).filter(entry => entry !== undefined)")
    lines.push("    return preferArray ? flattened : flattened[0]")
    lines.push("}")
    lines.push("")
    lines.push("function __isAttioMultiValueAttribute(objectSlug: string, attributeSlug: string): boolean {")
    lines.push("    return (__attioMultiValueAttributeSlugsByObject[objectSlug] || []).includes(attributeSlug)")
    lines.push("}")
    lines.push("")
    lines.push("function __getAttioRecordValues<TValues extends Record<string, unknown>>(objectSlug: string, record: unknown): TValues {")
    lines.push('    const rawValues = record && typeof record === "object" ? (record as { values?: unknown }).values : undefined')
    lines.push('    if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) return {} as TValues')
    lines.push("    const flattenedValues: Record<string, unknown> = {}")
    lines.push("    for (const [attributeSlug, rawValue] of Object.entries(rawValues)) {")
    lines.push("        flattenedValues[attributeSlug] = __flattenAttioAttributeValue(rawValue, __isAttioMultiValueAttribute(objectSlug, attributeSlug))")
    lines.push("    }")
    lines.push("    return flattenedValues as TValues")
    lines.push("}")
    lines.push("")
    lines.push("const __attioMultiValueEntrySlugsByList: Record<string, readonly string[]> = {")
    for (const list of lists) {
        const multiValueSlugs = list.attributes
            .filter(attioIsMultiValue)
            .map(attr => `"${escapeString(attr.api_slug)}"`)
            .join(", ")
        lines.push(`    "${escapeString(list.apiSlug)}": [${multiValueSlugs}],`)
        lines.push(`    "${escapeString(list.listId)}": [${multiValueSlugs}],`)
    }
    lines.push("}")
    lines.push("")
    lines.push("function __getAttioEntryValues<TValues extends Record<string, unknown>>(listKey: string, rawEntryValues: unknown): TValues {")
    lines.push('    if (!rawEntryValues || typeof rawEntryValues !== "object" || Array.isArray(rawEntryValues)) return {} as TValues')
    lines.push("    const flattenedValues: Record<string, unknown> = {}")
    lines.push("    const multiValueSlugs = __attioMultiValueEntrySlugsByList[listKey] || []")
    lines.push("    for (const [attributeSlug, rawValue] of Object.entries(rawEntryValues)) {")
    lines.push("        flattenedValues[attributeSlug] = __flattenAttioAttributeValue(rawValue, multiValueSlugs.includes(attributeSlug))")
    lines.push("    }")
    lines.push("    return flattenedValues as TValues")
    lines.push("}")
    lines.push("")
    lines.push("function __requireAttioListParentObject(list: unknown, parentObjectSlug: string | null | undefined): string {")
    lines.push("    if (parentObjectSlug) return parentObjectSlug")
    lines.push('    if (list && typeof list === "object" && "parentObject" in (list as Record<string, unknown>)) {')
    lines.push("        const parentObject = (list as { parentObject?: unknown }).parentObject")
    lines.push('        if (typeof parentObject === "string" && parentObject.length > 0) return parentObject')
    lines.push("    }")
    lines.push('    throw new Error("parentObjectSlug is required when the list is passed as a plain ID/slug rather than a generated AttioList constant.")')
    lines.push("}")
    lines.push("")
    lines.push("function __enhanceAttioListEntry<TList>(list: TList, entry: unknown): AttioListEntryFor<TList> {")
    lines.push('    const raw = (entry && typeof entry === "object" ? entry : {}) as { entry_values?: unknown }')
    lines.push("    return { ...(raw as object), entry_values: __getAttioEntryValues(__normalizeAttioObjectSlug(list), raw.entry_values) } as AttioListEntryFor<TList>")
    lines.push("}")
    lines.push("")
    lines.push('function __enhanceAttioListEntriesResult<TList>(list: TList, result: ToolOutputByName["attio_read_list_entries"]): AttioListEntriesResult<TList> {')
    lines.push("    const entries = (result.entries || []).map(entry => __enhanceAttioListEntry(list, entry))")
    lines.push("    return { entries, count: entries.length, offset: result.offset ?? 0 }")
    lines.push("}")
    lines.push("")
    lines.push('function __enhanceAttioListEntryResult<TList>(list: TList, result: ToolOutputByName["attio_read_list_entries"]): AttioListEntryResult<TList> {')
    lines.push('    if (!result.entry) throw new Error("Attio returned a response without the expected list entry payload.")')
    lines.push("    return __enhanceAttioListEntry(list, result.entry)")
    lines.push("}")
    lines.push("")
    lines.push('function __enhanceAttioHistoryResult<TValue>(result: ToolOutputByName["attio_read_records"]): AttioAttributeHistoryResult<TValue> {')
    lines.push("    const history = (result.history || []).map(entry => ({ active_from: entry.active_from, active_until: entry.active_until, value: __flattenAttioLeafValue(entry) as TValue }))")
    lines.push("    return { history, count: history.length }")
    lines.push("}")
    lines.push("")
    lines.push('registerEventTransform("attio", (event) => {')
    lines.push("    const e = event as { record?: { values?: unknown }; resourceIds?: { object_id?: string } }")
    lines.push("    if (!e?.record?.values) return event")
    lines.push("    const objectId = e.resourceIds?.object_id")
    lines.push("    const slug = objectId ? __attioObjectSlugByObjectId[objectId] : undefined")
    lines.push("    if (!slug) return event")
    lines.push("    return { ...e, record: { ...e.record, values: __getAttioRecordValues(slug, e.record) } }")
    lines.push("})")
    return lines
}

function prepareAttioSection(inst: AttioInstanceData | undefined, tools: ToolDefinition[]): SectionContext<AttioSectionContext> {
    if (!inst) return sectionData([])
    const objects = buildGeneratedAttioObjects(inst)
    const lists = buildGeneratedAttioLists(inst)
    return sectionData(
        [
            "registerEventTransform",
            "AttioOutputConfig",
            "TypedSkill",
            "AttioInputConfig",
            "AttioEventType",
            "TypedTrigger",
            "AttioTrigger",
            "AttioCallRecordingCreatedTrigger",
            "AttioCommentCreatedTrigger",
            "AttioCommentResolvedTrigger",
            "AttioCommentUnresolvedTrigger",
            "AttioCommentDeletedTrigger",
            "AttioListCreatedTrigger",
            "AttioListUpdatedTrigger",
            "AttioListDeletedTrigger",
            "AttioListAttributeCreatedTrigger",
            "AttioListAttributeUpdatedTrigger",
            "AttioListEntryCreatedTrigger",
            "AttioListEntryUpdatedTrigger",
            "AttioListEntryDeletedTrigger",
            "AttioObjectAttributeCreatedTrigger",
            "AttioObjectAttributeUpdatedTrigger",
            "AttioNoteCreatedTrigger",
            "AttioNoteContentUpdatedTrigger",
            "AttioNoteUpdatedTrigger",
            "AttioNoteDeletedTrigger",
            "AttioRecordCreatedTrigger",
            "AttioRecordMergedTrigger",
            "AttioRecordUpdatedTrigger",
            "AttioRecordDeletedTrigger",
            "AttioTaskCreatedTrigger",
            "AttioTaskUpdatedTrigger",
            "AttioTaskDeletedTrigger",
            "AttioWorkspaceMemberCreatedTrigger"
        ],
        {
            id: inst.id,
            skillToolType: buildSkillToolTypeForIntegration(tools, "attio"),
            objects,
            lists,
            valueTypeLines: attioValueTypeLines(objects, lists),
            runtimeLines: buildAttioRuntimeLines(objects, lists)
        }
    )
}

function prepareSnowflakeSection(inst: SnowflakeInstanceData | undefined, tools: ToolDefinition[]): SectionContext<SnowflakeSectionContext> {
    if (!inst) return sectionData([])
    return sectionData(["SnowflakeOutputConfig", "TypedSkill"], {
        id: inst.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "snowflake")
    })
}

function prepareHeyReachSection(inst: HeyReachInstanceData | undefined): SectionContext<HeyReachSectionContext> {
    if (!inst) return sectionData([])
    return sectionData(
        [
            "HeyReachInputConfig",
            "HeyReachEventType",
            "TypedTrigger",
            "HeyReachTrigger",
            "HeyReachConnectionRequestSentTrigger",
            "HeyReachConnectionRequestAcceptedTrigger",
            "HeyReachMessageSentTrigger",
            "HeyReachMessageReplyReceivedTrigger",
            "HeyReachInmailSentTrigger",
            "HeyReachInmailReplyReceivedTrigger",
            "HeyReachFollowSentTrigger",
            "HeyReachLikedPostTrigger",
            "HeyReachViewedProfileTrigger",
            "HeyReachCampaignCompletedTrigger",
            "HeyReachLeadTagUpdatedTrigger"
        ],
        {
            id: inst.id,
            campaignClass: buildResourceClassContext(
                "HeyReachCampaign",
                [
                    { classField: "campaignId", type: "string", sourceField: "id" },
                    { classField: "name", type: "string", sourceField: "name" }
                ],
                "name",
                inst.campaigns
            )
        }
    )
}

function prepareResendSection(instance: ResendInstanceData | undefined, tools: ToolDefinition[]): SectionContext<ResendSectionContext> {
    if (!instance) return sectionData([])
    const usedNames = new Set<string>()
    const templates = instance.templates.map(template => {
        let staticName = toGeneratedIdentifier(template.alias || template.name || "Template", "Template")
        while (usedNames.has(staticName)) staticName += "_"
        usedNames.add(staticName)

        const fields = template.variables.map(variable => {
            const optional = variable.fallbackValue !== null ? "?" : ""
            return `"${escapeString(variable.key)}"${optional}: ${variable.type}`
        })
        const variablesType = fields.length > 0 ? `{ ${fields.join("; ")} }` : "Record<string, never>"
        const variablesMetadata = template.variables
            .map(variable =>
                JSON.stringify({
                    key: variable.key,
                    type: variable.type,
                    required: variable.fallbackValue === null,
                    fallbackValue: variable.fallbackValue
                })
            )
            .join(", ")

        return { staticName, id: template.id, alias: template.alias, name: template.name, variablesType, variablesMetadata }
    })

    const sectionImports = templates.length > 0 ? ["ResendOutputConfig", "TypedSkill", "ToolInputByName"] : ["ResendOutputConfig", "TypedSkill"]
    return sectionData(sectionImports, {
        id: instance.id,
        skillToolType: buildSkillToolTypeForIntegration(tools, "resend"),
        templates
    })
}

function prepareToolsSection(tools: ToolDefinition[], input: CodegenInput, active: ActiveInstances): SectionContext<ToolsSectionContext> {
    if (tools.length === 0) return sectionData([])

    const imports = new Set(["TerseAgent", "ToolInputByName", "ToolOutputByName"])
    const attioPreludeLines: string[] = []

    const activeIdByIntegration = new Map<string, string | undefined>([
        ["slack", active.slack?.id],
        ["github", active.github?.integration.id],
        ["gmail", active.gmail?.id],
        ["linear", active.linear?.id],
        ["notion", active.notion?.id],
        ["posthog", active.posthog?.id],
        ["datadog", active.datadog?.id],
        ["launchdarkly", active.launchdarkly?.id],
        ["workos", active.workos?.id],
        ["attio", active.attio?.id],
        ["snowflake", active.snowflake?.id],
        ["resend", active.resend?.id]
    ])

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
                return "{ ...params, repository: __normalizeGitHubRepos((params).repository) }"
            case "searchGitHubCode":
            case "grepGitHubCode":
                return "{ ...params, repositoryNames: __normalizeGitHubReposNames((params).repositoryNames) }"
            default:
                return "params"
        }
    }

    const isAttioTool = (tool: ToolDefinition): boolean => tool.integration.toLowerCase() === "attio"
    const attioGeneratedObjects = buildGeneratedAttioObjects(active.attio)

    if (tools.some(isAttioTool)) {
        if (!active.attio) {
            attioPreludeLines.push(...attioValueTypeLines())
            attioPreludeLines.push("")
        }
        attioPreludeLines.push("type __AttioPrimitive = string | number | boolean | null")
        attioPreludeLines.push("type __AttioStructuredValue = Record<string, unknown>")
        attioPreludeLines.push("type __AttioValue = __AttioPrimitive | __AttioStructuredValue | (__AttioPrimitive | __AttioStructuredValue)[]")
        attioPreludeLines.push(
            "type __AttioFilterAtom<T> = T extends AttioSelectOption ? string : T extends AttioActorReference ? string : T extends AttioRecordReferenceValue ? string : T extends AttioCurrencyValue ? number : T"
        )
        attioPreludeLines.push("type __AttioFilterShorthand<T> = T extends (infer U)[] ? __AttioFilterAtom<U> | __AttioFilterAtom<U>[] : __AttioFilterAtom<T>")
        attioPreludeLines.push(
            "type __AttioFilterValue<T> = __AttioFilterShorthand<T> | { $eq?: __AttioFilterShorthand<T>; $contains?: string; $starts_with?: string; $ends_with?: string } | Record<string, unknown>"
        )
        attioPreludeLines.push(
            "type __AttioFilterExpression<TValues extends Record<string, unknown>> = Partial<{ [K in keyof TValues]: __AttioFilterValue<TValues[K]> }> & { $and?: Array<__AttioFilterExpression<TValues>>; $or?: Array<__AttioFilterExpression<TValues>> }"
        )
        attioPreludeLines.push("type __AttioRecordBase = { id?: { workspace_id?: string; object_id?: string; record_id?: string }; record_id?: string; web_url?: string; created_at?: string }")
        attioPreludeLines.push("type __AttioRecordWithValues<TValues extends Record<string, unknown>> = __AttioRecordBase & TValues & { values: TValues; attributes: TValues }")
        attioPreludeLines.push("")

        if (attioGeneratedObjects.length > 0) {
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
            "export type AttioQueryRecordsParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; filter?: AttioFilterFor<TObject> | null; limit?: number | null; offset?: number | null }"
        )
        attioPreludeLines.push("export type AttioSearchRecordsParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; query: string; limit?: number | null }")
        attioPreludeLines.push("export type AttioGetRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string }")
        attioPreludeLines.push("export type AttioCreateRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; values: AttioValuesFor<TObject> }")
        attioPreludeLines.push(
            'export type AttioUpdateRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string; values: Partial<AttioValuesFor<TObject>>; multiselectMode?: "overwrite" | "append" | null }'
        )
        attioPreludeLines.push(
            "export type AttioUpsertRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; matchingAttribute: AttioAttributeSlug<TObject>; records: AttioValuesFor<TObject>[] }"
        )
        attioPreludeLines.push("export type AttioDeleteRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string }")
        attioPreludeLines.push(
            "export type AttioGetAttributeHistoryParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string; attribute: AttioAttributeSlug<TObject>; limit?: number | null; offset?: number | null }"
        )
        attioPreludeLines.push('export type AttioWorkspaceMembersResult = ToolOutputByName["attio_workspace_members"]')
        attioPreludeLines.push('export type AttioRecordsResult = ToolOutputByName["attio_read_records"]')
        attioPreludeLines.push(
            "export type AttioQueryRecordsResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { records: Array<AttioRecordFor<TObject>>; count: number; offset: number }"
        )
        attioPreludeLines.push('export type AttioSearchRecordsResult = { matches: NonNullable<AttioRecordsResult["matches"]>; count: number }')
        attioPreludeLines.push("export type AttioUpsertRecordResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { records: Array<AttioRecordFor<TObject>>; count: number }")
        attioPreludeLines.push("export type AttioSingleRecordResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = AttioRecordFor<TObject>")
        attioPreludeLines.push('export type AttioListsResult = ToolOutputByName["attio_read_lists"]')
        attioPreludeLines.push("export type AttioEntryValuesFor<TList> = TList extends { __entryValues: infer TValues } ? TValues : Record<string, unknown>")
        attioPreludeLines.push(
            "export type AttioEntryRecordValuesFor<TList> = TList extends { __entryRecordValues: infer TValues extends Record<string, unknown> } ? TValues : Record<string, unknown>"
        )
        attioPreludeLines.push("export type AttioEntryFilterFor<TList> = __AttioFilterExpression<AttioEntryRecordValuesFor<TList>>")
        attioPreludeLines.push(
            "export type AttioListEntryFor<TList> = { id: { workspace_id: string; list_id: string; entry_id: string }; parent_record_id: string; parent_object: string; created_at: string; entry_values: AttioEntryRecordValuesFor<TList> }"
        )
        attioPreludeLines.push("export type AttioListEntriesResult<TList> = { entries: Array<AttioListEntryFor<TList>>; count: number; offset: number }")
        attioPreludeLines.push("export type AttioListEntryResult<TList> = AttioListEntryFor<TList>")
        attioPreludeLines.push("type __AttioSingleValue<T> = T extends (infer U)[] ? U : T")
        attioPreludeLines.push("export type AttioAttributeHistoryEntryFor<TValue> = { active_from: string; active_until: string | null; value: TValue }")
        attioPreludeLines.push("export type AttioAttributeHistoryResult<TValue = unknown> = { history: Array<AttioAttributeHistoryEntryFor<TValue>>; count: number }")
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
        attioPreludeLines.push("function __serializeAttioValues(values: unknown): string {")
        attioPreludeLines.push("    return JSON.stringify(values ?? {})")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push("function __serializeAttioRecords(records: unknown): string {")
        attioPreludeLines.push("    if (!Array.isArray(records)) return JSON.stringify([])")
        attioPreludeLines.push('    return JSON.stringify(records.filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null && !Array.isArray(record)))')
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
        attioPreludeLines.push("function __requireAttioPayload<T>(value: T | null | undefined, what: string): T {")
        attioPreludeLines.push('    if (value === null || value === undefined) throw new Error("Attio returned a response without the expected " + what + " payload.")')
        attioPreludeLines.push("    return value")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push(
            'function __enhanceAttioQueryResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_read_records"]): AttioQueryRecordsResult<TObject> {'
        )
        attioPreludeLines.push("    const records = (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>")
        attioPreludeLines.push("    return { records, count: records.length, offset: result.offset ?? 0 }")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push('function __enhanceAttioSearchResult(result: ToolOutputByName["attio_read_records"]): AttioSearchRecordsResult {')
        attioPreludeLines.push("    const matches = result.matches ?? []")
        attioPreludeLines.push("    return { matches, count: matches.length }")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push(
            'function __enhanceAttioUpsertResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_upsert_record"]): AttioUpsertRecordResult<TObject> {'
        )
        attioPreludeLines.push("    const records = (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>")
        attioPreludeLines.push("    return { records, count: records.length }")
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
        attioPreludeLines.push(
            'function __enhanceAttioSingleRecordResult<TObject extends GeneratedAttioObject>(object: TObject, result: ToolOutputByName["attio_read_records"]): AttioSingleRecordResult<TObject> {'
        )
        attioPreludeLines.push('    return __requireAttioPayload(__enhanceAttioRecord(object, result.record), "record")')
        attioPreludeLines.push("}")
        attioPreludeLines.push("")
    }

    const hasPosthogEventNames = (input.posthog[0]?.projects ?? []).some(project => project.events.length > 0)
    const hasResendTemplates = (active.resend?.templates.length ?? 0) > 0

    const paramTypes: ToolParamTypeContext[] = []
    for (const tool of tools) {
        if (isAttioTool(tool)) continue
        // Emitted by the Resend section as a per-template discriminated union
        if (tool.name === "resend_send_template" && hasResendTemplates) continue
        const key = `"${escapeString(tool.name)}"`
        let tsType = hasAutoFillId(tool) ? `Omit<ToolInputByName[${key}], "integrationId">` : `ToolInputByName[${key}]`
        if (tool.name === "searchPosthogEvents" && hasPosthogEventNames) {
            // Custom events type-check against the generated union; $-prefixed builtins are always allowed
            tsType = `Omit<ToolInputByName[${key}], "integrationId" | "eventName"> & { eventName?: PosthogEventName | \`$\${string}\` | null }`
        }
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
            const integrationId = activeIdByIntegration.get(integration)
            if (!integrationId) continue
            rawGroups.push({ key: integration, integration, tools: integrationTools, integrationId })
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
        methods: group.tools.flatMap(tool => {
            const methodName = toCamelCase(tool.displayName)
            const paramsType = toolNameToInterfaceName(tool.name)
            const normalizedParamsExpr = group.integration === "github" ? normalizeGitHubReposParams(tool.name) : "params"

            if (group.integration === "attio" && group.integrationId) {
                const attioMethods = buildAttioToolMethods(group.integrationId, tool)
                if (attioMethods) return attioMethods
            }

            const generatedSignature = `${methodName}(params: ${paramsType}): Promise<ToolOutputByName["${escapeString(tool.name)}"]>`

            let runtimeLines: string[]
            if (group.integrationId && hasAutoFillId(tool)) {
                runtimeLines = [
                    `${methodName}: (params: ${paramsType}) =>`,
                    `    TerseAgent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}), integrationId: "${escapeString(group.integrationId)}" }),`
                ]
            } else {
                runtimeLines = [
                    `${methodName}: (params: ${paramsType}) =>`,
                    `    TerseAgent.executeTool<ToolOutputByName["${escapeString(tool.name)}"]>("${escapeString(tool.name)}", ${normalizedParamsExpr}),`
                ]
            }

            return [
                {
                    description: tool.description || undefined,
                    generatedSignature,
                    runtimeLines
                }
            ]
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

function buildAttioRecordsMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    const call = (requestExpr: string) => `TerseAgent.executeTool<ToolOutputByName["${toolName}"]>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })`
    const objectSlug = "objectSlug: __normalizeAttioObjectSlug(params.object)"

    switch (toolName) {
        case "attio_read_records":
            return [
                {
                    description: attioActionDescription(toolName, "query"),
                    generatedSignature: "queryRecords<TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>): Promise<AttioQueryRecordsResult<TObject>>",
                    runtimeLines: [
                        "queryRecords: <TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>) =>",
                        `    ${call(`{ action: "query", ${objectSlug}, filter: __serializeAttioFilter(params.filter), limit: params.limit ?? null, offset: params.offset ?? null }`)}.then(result => __enhanceAttioQueryResult(params.object, result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "search"),
                    generatedSignature: "searchRecords<TObject extends GeneratedAttioObject>(params: AttioSearchRecordsParams<TObject>): Promise<AttioSearchRecordsResult>",
                    runtimeLines: [
                        "searchRecords: <TObject extends GeneratedAttioObject>(params: AttioSearchRecordsParams<TObject>) =>",
                        `    ${call(`{ action: "search", ${objectSlug}, query: params.query, limit: params.limit ?? null }`)}.then(result => __enhanceAttioSearchResult(result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "get"),
                    generatedSignature: "getRecord<TObject extends GeneratedAttioObject>(params: AttioGetRecordParams<TObject>): Promise<AttioSingleRecordResult<TObject>>",
                    runtimeLines: [
                        "getRecord: <TObject extends GeneratedAttioObject>(params: AttioGetRecordParams<TObject>) =>",
                        `    ${call(`{ action: "get", ${objectSlug}, recordId: params.recordId }`)}.then(result => __enhanceAttioSingleRecordResult(params.object, result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "get_attribute_history"),
                    generatedSignature:
                        "getAttributeHistory<TObject extends GeneratedAttioObject, TAttr extends AttioAttributeSlug<TObject>>(params: AttioGetAttributeHistoryParams<TObject> & { attribute: TAttr }): Promise<AttioAttributeHistoryResult<__AttioSingleValue<NonNullable<AttioRecordValuesFor<TObject>[TAttr & keyof AttioRecordValuesFor<TObject>]>>>>",
                    runtimeLines: [
                        "getAttributeHistory: <TObject extends GeneratedAttioObject, TAttr extends AttioAttributeSlug<TObject>>(params: AttioGetAttributeHistoryParams<TObject> & { attribute: TAttr }) =>",
                        `    ${call(`{ action: "get_attribute_history", ${objectSlug}, recordId: params.recordId, attributeSlug: params.attribute, limit: params.limit ?? null, offset: params.offset ?? null }`)}.then(result => __enhanceAttioHistoryResult<__AttioSingleValue<NonNullable<AttioRecordValuesFor<TObject>[TAttr & keyof AttioRecordValuesFor<TObject>]>>>(result)),`
                    ]
                }
            ]
        case "attio_create_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "createRecord<TObject extends GeneratedAttioObject>(params: AttioCreateRecordParams<TObject>): Promise<AttioSingleRecordResult<TObject>>",
                    runtimeLines: [
                        "createRecord: <TObject extends GeneratedAttioObject>(params: AttioCreateRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, values: JSON.stringify(params.values) }`)}.then(result => __enhanceAttioSingleRecordResult(params.object, result)),`
                    ]
                }
            ]
        case "attio_update_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "updateRecord<TObject extends GeneratedAttioObject>(params: AttioUpdateRecordParams<TObject>): Promise<AttioSingleRecordResult<TObject>>",
                    runtimeLines: [
                        "updateRecord: <TObject extends GeneratedAttioObject>(params: AttioUpdateRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, recordId: params.recordId, values: JSON.stringify(params.values), multiselectMode: params.multiselectMode ?? null }`)}.then(result => __enhanceAttioSingleRecordResult(params.object, result)),`
                    ]
                }
            ]
        case "attio_upsert_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "upsertRecord<TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>): Promise<AttioUpsertRecordResult<TObject>>",
                    runtimeLines: [
                        "upsertRecord: <TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, matchingAttribute: params.matchingAttribute, records: __serializeAttioRecords(params.records) }`)}.then(result => __enhanceAttioUpsertResult(params.object, result)),`
                    ]
                }
            ]
        case "attio_delete_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "deleteRecord<TObject extends GeneratedAttioObject>(params: AttioDeleteRecordParams<TObject>): Promise<void>",
                    runtimeLines: [
                        "deleteRecord: <TObject extends GeneratedAttioObject>(params: AttioDeleteRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, recordId: params.recordId }`)}.then(() => undefined),`
                    ]
                }
            ]
        default:
            return []
    }
}

function buildAttioToolMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] | null {
    switch (tool.name) {
        case "attio_read_records":
        case "attio_create_record":
        case "attio_update_record":
        case "attio_upsert_record":
        case "attio_delete_record":
            return buildAttioRecordsMethods(integrationId, tool)
        case "attio_read_lists":
        case "attio_create_list":
        case "attio_update_list":
        case "attio_read_list_entries":
        case "attio_add_list_entry":
        case "attio_upsert_list_entry":
        case "attio_update_list_entry":
        case "attio_remove_list_entry":
            return buildAttioListsMethods(integrationId, tool)
        default: {
            const specs = ATTIO_RESOURCE_METHOD_SPECS[tool.name]
            return specs ? buildAttioResourceMethods(integrationId, tool, specs) : null
        }
    }
}

// Method TSDoc is single-sourced: single-op tools inherit the tool description, action-mapped
// methods inherit the zod action literal's description.
function attioActionDescription(toolName: string, action: string): string | undefined {
    if (!isKnownToolName(toolName)) return undefined
    const parsed = attioRequestUnionJsonSchema.safeParse(z.toJSONSchema(ToolDefinitions[toolName].inputSchema))
    if (!parsed.success) return undefined
    const request = parsed.data.properties.request
    for (const branch of request.oneOf ?? request.anyOf ?? []) {
        const actionBranch = attioActionBranchJsonSchema.safeParse(branch)
        if (actionBranch.success && actionBranch.data.properties.action.const === action) {
            return actionBranch.data.properties.action.description
        }
    }
    return undefined
}

function isKnownToolName(name: string): name is ToolName {
    return name in ToolDefinitions
}

const attioRequestUnionJsonSchema = z.object({
    properties: z.object({ request: z.object({ oneOf: z.array(z.unknown()).optional(), anyOf: z.array(z.unknown()).optional() }) })
})

const attioActionBranchJsonSchema = z.object({
    properties: z.object({ action: z.object({ const: z.string(), description: z.string().optional() }) })
})

const ATTIO_RESOURCE_METHOD_SPECS: Record<string, AttioResourceMethodSpec[]> = {
    attio_workspace_members: [
        { action: "list", methodName: "listWorkspaceMembers", emptyParams: true, result: { kind: "list", key: "members" } },
        { action: "get", methodName: "getWorkspaceMember", result: { kind: "single", key: "member", what: "workspace member" } }
    ],
    attio_read_tasks: [
        { action: "list", methodName: "listTasks", emptyParams: true, result: { kind: "list", key: "tasks" } },
        { action: "get", methodName: "getTask", result: { kind: "single", key: "task" } }
    ],
    attio_create_task: [{ methodName: "createTask", result: { kind: "single", key: "task" } }],
    attio_update_task: [{ methodName: "updateTask", result: { kind: "single", key: "task" } }],
    attio_delete_task: [{ methodName: "deleteTask", result: { kind: "void" } }],
    attio_read_notes: [
        { action: "list", methodName: "listNotes", emptyParams: true, result: { kind: "list", key: "notes" } },
        { action: "get", methodName: "getNote", result: { kind: "single", key: "note" } }
    ],
    attio_create_note: [{ methodName: "createNote", result: { kind: "single", key: "note" } }],
    attio_delete_note: [{ methodName: "deleteNote", result: { kind: "void" } }],
    attio_read_comments: [
        { action: "get", methodName: "getComment", result: { kind: "single", key: "comment" } },
        { action: "list_threads", methodName: "listThreads", emptyParams: true, result: { kind: "list", key: "threads" } },
        { action: "get_thread", methodName: "getThread", result: { kind: "single", key: "thread" } }
    ],
    attio_create_comment: [{ methodName: "createComment", result: { kind: "single", key: "comment" } }],
    attio_delete_comment: [{ methodName: "deleteComment", result: { kind: "void" } }],
    attio_meetings: [
        { action: "list", methodName: "listMeetings", emptyParams: true, result: { kind: "list", key: "meetings", cursor: true } },
        { action: "get", methodName: "getMeeting", result: { kind: "single", key: "meeting" } },
        { action: "list_recordings", methodName: "listCallRecordings", result: { kind: "list", key: "recordings", cursor: true } },
        { action: "get_transcript", methodName: "getCallTranscript", result: { kind: "singleWithCursor", key: "transcript" } }
    ],
    attio_read_files: [
        { action: "list", methodName: "listFiles", result: { kind: "list", key: "files", cursor: true } },
        { action: "get", methodName: "getFile", result: { kind: "single", key: "file" } },
        { action: "get_download_url", methodName: "getFileDownloadUrl", result: { kind: "single", key: "downloadUrl", what: "download URL" } }
    ],
    attio_upload_file: [{ methodName: "uploadFile", result: { kind: "single", key: "file" } }],
    attio_delete_file: [{ methodName: "deleteFile", result: { kind: "void" } }],
    attio_read_schema: [
        { action: "list_objects", methodName: "listObjects", emptyParams: true, result: { kind: "list", key: "objects" } },
        { action: "get_object", methodName: "getObject", result: { kind: "single", key: "object" } },
        { action: "list_attributes", methodName: "listAttributes", result: { kind: "list", key: "attributes" } },
        { action: "list_statuses", methodName: "listStatuses", result: { kind: "list", key: "statuses" } },
        { action: "list_select_options", methodName: "listSelectOptions", result: { kind: "list", key: "selectOptions" } }
    ],
    attio_modify_schema: [
        { action: "create_object", methodName: "createObject", result: { kind: "single", key: "object" } },
        { action: "update_object", methodName: "updateObject", result: { kind: "single", key: "object" } },
        { action: "create_attribute", methodName: "createAttribute", result: { kind: "single", key: "attribute" } },
        { action: "update_attribute", methodName: "updateAttribute", result: { kind: "single", key: "attribute" } },
        { action: "create_status", methodName: "createStatus", result: { kind: "single", key: "status" } },
        { action: "update_status", methodName: "updateStatus", result: { kind: "single", key: "status" } },
        { action: "create_select_option", methodName: "createSelectOption", result: { kind: "single", key: "selectOption" } },
        { action: "update_select_option", methodName: "updateSelectOption", result: { kind: "single", key: "selectOption" } }
    ]
}

// Each method narrows the wire result to its action's payload at runtime: singles unwrap to the bare
// entity (throwing if absent), lists rebuild a { items, count, nextCursor? } wrapper, deletes resolve void.
function attioResultParts(toolName: string, result: AttioResultSpec): { resultType: string; thenExpr: string } {
    const base = `ToolOutputByName["${toolName}"]`
    switch (result.kind) {
        case "single":
            return {
                resultType: `NonNullable<${base}["${result.key}"]>`,
                thenExpr: `.then(result => __requireAttioPayload(result.${result.key}, "${result.what ?? result.key}"))`
            }
        case "singleWithCursor":
            return {
                resultType: `{ ${result.key}: NonNullable<${base}["${result.key}"]>; nextCursor: string | null }`,
                thenExpr: `.then(result => ({ ${result.key}: __requireAttioPayload(result.${result.key}, "${result.what ?? result.key}"), nextCursor: result.nextCursor ?? null }))`
            }
        case "list": {
            const cursorType = result.cursor ? "; nextCursor: string | null" : ""
            const cursorValue = result.cursor ? ", nextCursor: result.nextCursor ?? null" : ""
            return {
                resultType: `{ ${result.key}: NonNullable<${base}["${result.key}"]>; count: number${cursorType} }`,
                thenExpr: `.then(result => ({ ${result.key}: result.${result.key} ?? [], count: (result.${result.key} ?? []).length${cursorValue} }))`
            }
        }
        case "void":
            return { resultType: "void", thenExpr: ".then(() => undefined)" }
        default:
            throw result satisfies never
    }
}

function buildAttioResourceMethods(integrationId: string, tool: ToolDefinition, specs: AttioResourceMethodSpec[]): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    return specs.map(spec => {
        const paramsType = spec.action ? `Omit<Extract<ToolInputByName["${toolName}"]["request"], { action: "${spec.action}" }>, "action">` : `ToolInputByName["${toolName}"]["request"]`
        const requestExpr = spec.action ? `{ action: "${spec.action}", ...params }` : "params"
        const { resultType, thenExpr } = attioResultParts(toolName, spec.result)
        return {
            description: spec.action ? attioActionDescription(toolName, spec.action) : tool.description || undefined,
            generatedSignature: `${spec.methodName}(${spec.emptyParams ? `params?: ${paramsType}` : `params: ${paramsType}`}): Promise<${resultType}>`,
            runtimeLines: [
                `${spec.methodName}: (params: ${paramsType}${spec.emptyParams ? " = {}" : ""}) =>`,
                `    TerseAgent.executeTool<ToolOutputByName["${toolName}"]>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })${thenExpr},`
            ]
        }
    })
}

function buildAttioListsMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    const call = (requestExpr: string) => `TerseAgent.executeTool<ToolOutputByName["${toolName}"]>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })`
    const listKey = "listIdOrSlug: __normalizeAttioObjectSlug(params.list)"
    const listParam = "list: GeneratedAttioList | string"

    switch (toolName) {
        case "attio_read_lists":
            return [
                {
                    description: attioActionDescription(toolName, "list"),
                    generatedSignature: 'listLists(): Promise<{ lists: NonNullable<AttioListsResult["lists"]>; count: number }>',
                    runtimeLines: ["listLists: () =>", `    ${call('{ action: "list" }')}.then(result => ({ lists: result.lists ?? [], count: (result.lists ?? []).length })),`]
                },
                {
                    description: attioActionDescription(toolName, "get"),
                    generatedSignature: `getList(params: { ${listParam} }): Promise<NonNullable<AttioListsResult["list"]>>`,
                    runtimeLines: [`getList: (params: { ${listParam} }) =>`, `    ${call(`{ action: "get", ${listKey} }`)}.then(result => __requireAttioPayload(result.list, "list")),`]
                }
            ]
        case "attio_create_list":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: 'createList(params: ToolInputByName["attio_create_list"]["request"]): Promise<NonNullable<AttioListsResult["list"]>>',
                    runtimeLines: ['createList: (params: ToolInputByName["attio_create_list"]["request"]) =>', `    ${call("params")}.then(result => __requireAttioPayload(result.list, "list")),`]
                }
            ]
        case "attio_update_list":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: `updateList(params: { ${listParam}; name: string }): Promise<NonNullable<AttioListsResult["list"]>>`,
                    runtimeLines: [
                        `updateList: (params: { ${listParam}; name: string }) =>`,
                        `    ${call(`{ ${listKey}, name: params.name }`)}.then(result => __requireAttioPayload(result.list, "list")),`
                    ]
                }
            ]
        case "attio_read_list_entries":
            return [
                {
                    description: attioActionDescription(toolName, "query_entries"),
                    generatedSignature:
                        "queryListEntries<TList extends GeneratedAttioList | string>(params: { list: TList; filter?: AttioEntryFilterFor<TList> | null; parentRecordId?: string | null; parentObjectSlug?: string; limit?: number | null; offset?: number | null }): Promise<AttioListEntriesResult<TList>>",
                    runtimeLines: [
                        "queryListEntries: <TList extends GeneratedAttioList | string>(params: { list: TList; filter?: AttioEntryFilterFor<TList> | null; parentRecordId?: string | null; parentObjectSlug?: string; limit?: number | null; offset?: number | null }) =>",
                        `    ${call(
                            '{ action: "query_entries", listIdOrSlug: __normalizeAttioObjectSlug(params.list), filter: __serializeAttioFilter(params.filter), parentRecordId: params.parentRecordId ?? null, parentObjectSlug: params.parentRecordId ? __requireAttioListParentObject(params.list, params.parentObjectSlug) : null, limit: params.limit ?? null, offset: params.offset ?? null }'
                        )}.then(result => __enhanceAttioListEntriesResult(params.list, result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "get_entry"),
                    generatedSignature: "getListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string }): Promise<AttioListEntryResult<TList>>",
                    runtimeLines: [
                        "getListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string }) =>",
                        `    ${call('{ action: "get_entry", listIdOrSlug: __normalizeAttioObjectSlug(params.list), entryId: params.entryId }')}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_add_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature:
                        "addListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }): Promise<AttioListEntryResult<TList>>",
                    runtimeLines: [
                        "addListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }) =>",
                        `    ${call(
                            "{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), parentObjectSlug: __requireAttioListParentObject(params.list, params.parentObjectSlug), parentRecordId: params.parentRecordId, entryValues: __serializeAttioValues(params.entryValues) }"
                        )}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_upsert_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature:
                        "upsertListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }): Promise<AttioListEntryResult<TList>>",
                    runtimeLines: [
                        "upsertListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }) =>",
                        `    ${call(
                            "{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), parentObjectSlug: __requireAttioListParentObject(params.list, params.parentObjectSlug), parentRecordId: params.parentRecordId, entryValues: __serializeAttioValues(params.entryValues) }"
                        )}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_update_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature:
                        'updateListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string; entryValues: Partial<AttioEntryValuesFor<TList>>; multiselectMode?: "overwrite" | "append" | null }): Promise<AttioListEntryResult<TList>>',
                    runtimeLines: [
                        'updateListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string; entryValues: Partial<AttioEntryValuesFor<TList>>; multiselectMode?: "overwrite" | "append" | null }) =>',
                        `    ${call(
                            "{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), entryId: params.entryId, entryValues: __serializeAttioValues(params.entryValues), multiselectMode: params.multiselectMode ?? null }"
                        )}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_remove_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: `removeListEntry(params: { ${listParam}; entryId: string }): Promise<void>`,
                    runtimeLines: [
                        `removeListEntry: (params: { ${listParam}; entryId: string }) =>`,
                        `    ${call("{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), entryId: params.entryId }")}.then(() => undefined),`
                    ]
                }
            ]
        default:
            return []
    }
}

type AttioResultSpec = { kind: "single"; key: string; what?: string } | { kind: "singleWithCursor"; key: string; what?: string } | { kind: "list"; key: string; cursor?: boolean } | { kind: "void" }

interface AttioResourceMethodSpec {
    /** Discriminant to inject into the request; omitted for single-op tools with flat request schemas. */
    action?: string
    methodName: string
    emptyParams?: boolean
    result: AttioResultSpec
}

function prepareSystemSection(): SectionContext<SystemSectionContext> {
    return sectionData(
        [
            "TimeTriggerConfig",
            "WebConfig",
            "ImageEditConfig",
            "MemoryConfig",
            "TypedSkill",
            "WebhookInputConfig",
            "WebhookTrigger",
            "CronTrigger",
            "TypedTrigger",
            "WebMonitorConfig",
            "WebMonitorTrigger",
            "FrequencyUnit",
            "InferStructuredOutput"
        ],
        {}
    )
}

export function prepareTemplateContext(input: CodegenInput): TemplateContext {
    const allImports = new Set<string>()
    const active = resolveActiveInstances(input)

    const github = prepareGitHubSection(active.github, input.tools)
    const gmail = prepareGmailSection(active.gmail, input.tools)
    const slack = prepareSlackSection(active.slack, input.tools)
    const linear = prepareLinearSection(active.linear, input.tools)
    const notion = prepareNotionSection(active.notion, input.tools)
    const posthog = preparePosthogSection(active.posthog, input.tools)
    const datadog = prepareDatadogSection(active.datadog, input.tools)
    const launchdarkly = prepareLaunchDarklySection(active.launchdarkly, input.tools)
    const workos = prepareWorkOSSection(active.workos, input.tools)
    const attio = prepareAttioSection(active.attio, input.tools)
    const snowflake = prepareSnowflakeSection(active.snowflake, input.tools)
    const heyreach = prepareHeyReachSection(active.heyreach)
    const resend = prepareResendSection(active.resend, input.tools)
    const tools = prepareToolsSection(input.tools, input, active)
    const system = prepareSystemSection()

    const sections = [github, gmail, slack, linear, notion, posthog, datadog, launchdarkly, workos, attio, snowflake, heyreach, resend, tools, system]

    for (const section of sections) {
        section.imports.forEach(value => allImports.add(value))
    }

    const imports = [...allImports].sort()

    return {
        imports,
        useMultilineImports: imports.length > 3,
        availableIntegrations: input.availableIntegrations.length > 0 ? input.availableIntegrations.join(", ") : undefined,
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
        heyreach: heyreach.data,
        resend: resend.data,
        tools: tools.data,
        system: system.data!
    }
}

function resolveActiveInstances(input: CodegenInput): ActiveInstances {
    const pins = input.activeConnections
    return {
        github: selectActiveInstance(input.github, pins[IntegrationType.GITHUB], data => data.integration.id),
        gmail: selectActiveInstance(input.gmail, pins[IntegrationType.GMAIL], data => data.id),
        slack: selectActiveInstance(input.slack, pins[IntegrationType.SLACK], data => data.id),
        linear: selectActiveInstance(input.linear, pins[IntegrationType.LINEAR], data => data.id),
        notion: selectActiveInstance(input.notion, pins[IntegrationType.NOTION], data => data.id),
        posthog: selectActiveInstance(input.posthog, pins[IntegrationType.POSTHOG], data => data.id),
        datadog: selectActiveInstance(input.datadog, pins[IntegrationType.DATADOG], data => data.id),
        launchdarkly: selectActiveInstance(input.launchdarkly, pins[IntegrationType.LAUNCHDARKLY], data => data.id),
        workos: selectActiveInstance(input.workos, pins[IntegrationType.WORKOS], data => data.id),
        attio: selectActiveInstance(input.attio, pins[IntegrationType.ATTIO], data => data.id),
        snowflake: selectActiveInstance(input.snowflake, pins[IntegrationType.SNOWFLAKE], data => data.id),
        heyreach: selectActiveInstance(input.heyreach, pins[IntegrationType.HEY_REACH], data => data.id),
        resend: selectActiveInstance(input.resend, pins[IntegrationType.RESEND], data => data.id)
    }
}

function selectActiveInstance<T>(instances: T[], activeConnectionId: string | undefined, idOf: (instance: T) => string): T | undefined {
    if (activeConnectionId) {
        const match = instances.find(instance => idOf(instance) === activeConnectionId)
        if (match) return match
    }
    return instances[0]
}

type ActiveInstances = {
    github: GitHubInstanceData | undefined
    gmail: IntegrationInstanceData | undefined
    slack: SlackInstanceData | undefined
    linear: LinearInstanceData | undefined
    notion: NotionInstanceData | undefined
    posthog: PosthogInstanceData | undefined
    datadog: DatadogInstanceData | undefined
    launchdarkly: LaunchDarklyInstanceData | undefined
    workos: IntegrationInstanceData | undefined
    attio: AttioInstanceData | undefined
    snowflake: SnowflakeInstanceData | undefined
    heyreach: HeyReachInstanceData | undefined
    resend: ResendInstanceData | undefined
}
