import { IntegrationType, type ToolDefinition, ToolDefinitions, type ToolName, runHistoryActionBaseSchema, toolsWithIntegrationId } from "terse-types"
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
    SlackInstanceData,
    SnowflakeInstanceData
} from "../codegenTypes.js"

import {
    ATTIO_RESOURCE_METHOD_SPECS,
    type AttioResourceMethodSpec,
    type AttioResultSpec,
    attioIsMultiValue,
    attioListValueTypeNames,
    attioMethodParamsTypeName,
    attioObjectValueTypeNames,
    attioOutputTypeName,
    buildAttioObjectTypeDeclarations,
    buildAttioRecordTriggerAliases,
    buildAttioToolTypeDeclarations,
    buildAttioValueTypeDeclarations
} from "./attioProjection.js"
import { buildTriggerTypeDeclarations } from "./triggerTypeDeclarations.js"
import { type HoistedShape, printHoistedShape, printType } from "./typePrinter.js"

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
    recordTriggerAliases: string[]
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

interface ToolMethodContext {
    description?: string
    generatedSignature: string
    runtimeLines: string[]
}

interface ToolboxEntryContext {
    key: string
    integrationType: string
    typeName: string
    constName: string
}

interface ToolFileContext extends ToolboxEntryContext {
    declarations: string[]
    methods: ToolMethodContext[]
}

interface ToolsSectionContext {
    toolFiles: Record<string, ToolFileContext>
    toolboxEntries: ToolboxEntryContext[]
    commonToolDeclarations: string[]
    attioSchemaLines: string[]
    attioRuntimeHelperLines: string[]
    githubRepoMappings: Array<{ name: string; fullName: string }>
}

interface SystemSectionContext {}

export interface TemplateContext {
    imports: string[]
    useMultilineImports: boolean
    availableIntegrations?: string
    toolboxEntries: ToolboxEntryContext[]
    toolFiles: Record<string, ToolFileContext>
    triggerFiles: Record<string, string[]>
    commonTriggerDeclarations: string[]
    commonToolDeclarations: string[]
    attioSchemaLines: string[]
    attioRuntimeHelperLines: string[]
    githubRepoMappings: Array<{ name: string; fullName: string }>
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

function toolNameToTypeName(name: string, suffix: "Params" | "Result"): string {
    return (
        name
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join("") + suffix
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

function attioOptionConstLines(
    objects: Array<{ staticName: string; attributes: Array<AttioAttributeData & { api_slug: string }> }>,
    lists: Array<{ staticName: string; attributes: Array<AttioAttributeData & { api_slug: string }> }>
): string[] {
    const lines: string[] = []

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
            recordValuesType: attioObjectValueTypeNames(staticName).record,
            inputValuesType: attioObjectValueTypeNames(staticName).input,
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
            entryValuesType: attioListValueTypeNames(staticName).entry,
            entryRecordValuesType: attioListValueTypeNames(staticName).entryRecord,
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
    lines.push("function __enhanceAttioListEntriesResult<TList>(list: TList, result: AttioListsResult): AttioListEntriesResult<TList> {")
    lines.push("    const entries = (result.entries || []).map(entry => __enhanceAttioListEntry(list, entry))")
    lines.push("    return { entries, count: entries.length, offset: result.offset ?? 0 }")
    lines.push("}")
    lines.push("")
    lines.push("function __enhanceAttioListEntryResult<TList>(list: TList, result: AttioListsResult): AttioListEntryResult<TList> {")
    lines.push('    if (!result.entry) throw new Error("Attio returned a response without the expected list entry payload.")')
    lines.push("    return __enhanceAttioListEntry(list, result.entry)")
    lines.push("}")
    lines.push("")
    lines.push("function __enhanceAttioHistoryResult<TValue>(result: AttioRecordsResult): AttioAttributeHistoryResult<TValue> {")
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

async function prepareAttioSection(inst: AttioInstanceData | undefined, tools: ToolDefinition[]): Promise<SectionContext<AttioSectionContext>> {
    if (!inst) return sectionData([])
    const objects = buildGeneratedAttioObjects(inst)
    const lists = buildGeneratedAttioLists(inst)
    const valueTypeLines = [...(await buildAttioValueTypeDeclarations()), ...(await buildAttioObjectTypeDeclarations(objects, lists)), ...attioOptionConstLines(objects, lists)]
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
            valueTypeLines,
            recordTriggerAliases: buildAttioRecordTriggerAliases(objects),
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

async function prepareToolsSection(tools: ToolDefinition[], input: CodegenInput, active: ActiveInstances): Promise<SectionContext<ToolsSectionContext>> {
    if (tools.length === 0) return sectionData([])

    const imports = new Set(["TerseAgent"])
    const attioSchemaLines: string[] = []
    const attioRuntimeHelperLines: string[] = []
    const hoistedShapes: HoistedShape[] = [{ name: "RunHistoryAction", schema: runHistoryActionBaseSchema }]

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
        ["snowflake", active.snowflake?.id]
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
            attioSchemaLines.push(...(await buildAttioValueTypeDeclarations()))
        }
        attioSchemaLines.push(...(await buildAttioToolTypeDeclarations(tools.filter(isAttioTool).map(tool => tool.name))))
        attioSchemaLines.push("export type __AttioPrimitive = string | number | boolean | null")
        attioSchemaLines.push("export type __AttioStructuredValue = Record<string, unknown>")
        attioSchemaLines.push("export type __AttioValue = __AttioPrimitive | __AttioStructuredValue | (__AttioPrimitive | __AttioStructuredValue)[]")
        attioSchemaLines.push(
            "export type __AttioFilterAtom<T> = T extends AttioSelectOption ? string : T extends AttioActorReference ? string : T extends AttioRecordReferenceValue ? string : T extends AttioCurrencyValue ? number : T"
        )
        attioSchemaLines.push("export type __AttioFilterShorthand<T> = T extends (infer U)[] ? __AttioFilterAtom<U> | __AttioFilterAtom<U>[] : __AttioFilterAtom<T>")
        attioSchemaLines.push(
            "export type __AttioFilterValue<T> = __AttioFilterShorthand<T> | { $eq?: __AttioFilterShorthand<T>; $contains?: string; $starts_with?: string; $ends_with?: string } | Record<string, unknown>"
        )
        attioSchemaLines.push(
            "export type __AttioFilterExpression<TValues extends Record<string, unknown>> = Partial<{ [K in keyof TValues]: __AttioFilterValue<TValues[K]> }> & { $and?: Array<__AttioFilterExpression<TValues>>; $or?: Array<__AttioFilterExpression<TValues>> }"
        )
        attioSchemaLines.push('export type __AttioRecordWithValues<TValues extends Record<string, unknown>> = Omit<AttioRecordBase, "values"> & TValues & { values: TValues; attributes: TValues }')
        attioSchemaLines.push("")

        if (attioGeneratedObjects.length > 0) {
            attioSchemaLines.push("export type AttioInputValuesByObject = {")
            for (const object of attioGeneratedObjects) {
                attioSchemaLines.push(`    "${escapeString(object.apiSlug)}": ${attioObjectValueTypeNames(object.staticName).input}`)
            }
            attioSchemaLines.push("}")
            attioSchemaLines.push("")
            attioSchemaLines.push("export type AttioRecordValuesByObject = {")
            for (const object of attioGeneratedObjects) {
                attioSchemaLines.push(`    "${escapeString(object.apiSlug)}": ${attioObjectValueTypeNames(object.staticName).record}`)
            }
            attioSchemaLines.push("}")
            attioSchemaLines.push("")
            attioSchemaLines.push("export type AttioFilterByObject = {")
            for (const object of attioGeneratedObjects) {
                attioSchemaLines.push(`    "${escapeString(object.apiSlug)}": __AttioFilterExpression<AttioRecordValuesByObject["${escapeString(object.apiSlug)}"]>`)
            }
            attioSchemaLines.push("}")
            attioSchemaLines.push("")
            attioSchemaLines.push("export type AttioRecordByObject = {")
            for (const object of attioGeneratedObjects) {
                attioSchemaLines.push(`    "${escapeString(object.apiSlug)}": __AttioRecordWithValues<AttioRecordValuesByObject["${escapeString(object.apiSlug)}"]>`)
            }
            attioSchemaLines.push("}")
        } else {
            attioSchemaLines.push("export type AttioInputValuesByObject = Record<string, Record<string, __AttioValue>>")
            attioSchemaLines.push("export type AttioRecordValuesByObject = Record<string, Record<string, __AttioValue>>")
            attioSchemaLines.push("export type AttioFilterByObject = Record<string, __AttioFilterExpression<Record<string, __AttioValue>>>")
            attioSchemaLines.push("export type AttioRecordByObject = Record<string, __AttioRecordWithValues<Record<string, __AttioValue>>>")
        }

        attioSchemaLines.push("")
        attioSchemaLines.push(
            'export type AttioValuesFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = TObject extends { __inputValues: infer TInputValues } ? TInputValues : AttioInputValuesByObject[TObject["apiSlug"]]'
        )
        attioSchemaLines.push(
            'export type AttioRecordValuesFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = TObject extends { __recordValues: infer TRecordValues } ? TRecordValues : AttioRecordValuesByObject[TObject["apiSlug"]]'
        )
        attioSchemaLines.push("export type AttioAttributeSlug<TObject extends GeneratedAttioObject = GeneratedAttioObject> = Extract<keyof AttioValuesFor<TObject>, string>")
        attioSchemaLines.push("export type AttioFilterFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = __AttioFilterExpression<AttioRecordValuesFor<TObject>>")
        attioSchemaLines.push("export type AttioRecordFor<TObject extends GeneratedAttioObject = GeneratedAttioObject> = __AttioRecordWithValues<AttioRecordValuesFor<TObject>>")
        attioSchemaLines.push(
            "export type AttioQueryRecordsParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; filter?: AttioFilterFor<TObject> | null; limit?: number | null; offset?: number | null }"
        )
        attioSchemaLines.push("export type AttioSearchRecordsParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; query: string; limit?: number | null }")
        attioSchemaLines.push("export type AttioGetRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string }")
        attioSchemaLines.push("export type AttioCreateRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; values: AttioValuesFor<TObject> }")
        attioSchemaLines.push(
            'export type AttioUpdateRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string; values: Partial<AttioValuesFor<TObject>>; multiselectMode?: "overwrite" | "append" | null }'
        )
        attioSchemaLines.push(
            "export type AttioUpsertRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; matchingAttribute: AttioAttributeSlug<TObject>; records: AttioValuesFor<TObject>[] }"
        )
        attioSchemaLines.push("export type AttioDeleteRecordParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string }")
        attioSchemaLines.push(
            "export type AttioGetAttributeHistoryParams<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { object: TObject; recordId: string; attribute: AttioAttributeSlug<TObject>; limit?: number | null; offset?: number | null }"
        )
        attioSchemaLines.push(
            "export type AttioQueryRecordsResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { records: Array<AttioRecordFor<TObject>>; count: number; offset: number }"
        )
        attioSchemaLines.push('export type AttioSearchRecordsResult = { matches: NonNullable<AttioRecordsResult["matches"]>; count: number }')
        attioSchemaLines.push("export type AttioUpsertRecordResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = { records: Array<AttioRecordFor<TObject>>; count: number }")
        attioSchemaLines.push("export type AttioSingleRecordResult<TObject extends GeneratedAttioObject = GeneratedAttioObject> = AttioRecordFor<TObject>")
        attioSchemaLines.push("export type AttioEntryValuesFor<TList> = TList extends { __entryValues: infer TValues } ? TValues : Record<string, unknown>")
        attioSchemaLines.push("export type AttioEntryRecordValuesFor<TList> = TList extends { __entryRecordValues: infer TValues extends Record<string, unknown> } ? TValues : Record<string, unknown>")
        attioSchemaLines.push("export type AttioEntryFilterFor<TList> = __AttioFilterExpression<AttioEntryRecordValuesFor<TList>>")
        attioSchemaLines.push(
            "export type AttioListEntryFor<TList> = { id: { workspace_id: string; list_id: string; entry_id: string }; parent_record_id: string; parent_object: string; created_at: string; entry_values: AttioEntryRecordValuesFor<TList> }"
        )
        attioSchemaLines.push("export type AttioListEntriesResult<TList> = { entries: Array<AttioListEntryFor<TList>>; count: number; offset: number }")
        attioSchemaLines.push("export type AttioListEntryResult<TList> = AttioListEntryFor<TList>")
        attioSchemaLines.push("export type __AttioSingleValue<T> = T extends (infer U)[] ? U : T")
        attioSchemaLines.push("export type AttioAttributeHistoryEntryFor<TValue> = { active_from: string; active_until: string | null; value: TValue }")
        attioSchemaLines.push("export type AttioAttributeHistoryResult<TValue = unknown> = { history: Array<AttioAttributeHistoryEntryFor<TValue>>; count: number }")
        attioSchemaLines.push("")
        attioRuntimeHelperLines.push("function __normalizeAttioObjectSlug(object: unknown): string {")
        attioRuntimeHelperLines.push('    if (object && typeof object === "object" && "apiSlug" in (object as Record<string, unknown>)) {')
        attioRuntimeHelperLines.push("        const apiSlug = (object as { apiSlug?: unknown }).apiSlug")
        attioRuntimeHelperLines.push('        if (typeof apiSlug === "string" && apiSlug.length > 0) return apiSlug')
        attioRuntimeHelperLines.push("    }")
        attioRuntimeHelperLines.push('    return typeof object === "string" ? object : ""')
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __serializeAttioFilter(filter: unknown): string | null {")
        attioRuntimeHelperLines.push("    if (filter === undefined || filter === null) return null")
        attioRuntimeHelperLines.push("    return JSON.stringify(filter)")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __serializeAttioValues(values: unknown): string {")
        attioRuntimeHelperLines.push("    return JSON.stringify(values ?? {})")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __serializeAttioRecords(records: unknown): string {")
        attioRuntimeHelperLines.push("    if (!Array.isArray(records)) return JSON.stringify([])")
        attioRuntimeHelperLines.push(
            '    return JSON.stringify(records.filter((record): record is Record<string, unknown> => typeof record === "object" && record !== null && !Array.isArray(record)))'
        )
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push(
            "function __enhanceAttioRecord<TObject extends GeneratedAttioObject>(object: TObject, record: unknown): __AttioRecordWithValues<AttioRecordValuesFor<TObject>> | undefined {"
        )
        attioRuntimeHelperLines.push('    if (!record || typeof record !== "object") return undefined')
        attioRuntimeHelperLines.push("    const values = __getAttioRecordValues<AttioRecordValuesFor<TObject>>(__normalizeAttioObjectSlug(object), record)")
        attioRuntimeHelperLines.push("    return { ...values, ...(record as AttioRecordBase), values, attributes: values } as __AttioRecordWithValues<AttioRecordValuesFor<TObject>>")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __requireAttioPayload<T>(value: T | null | undefined, what: string): T {")
        attioRuntimeHelperLines.push('    if (value === null || value === undefined) throw new Error("Attio returned a response without the expected " + what + " payload.")')
        attioRuntimeHelperLines.push("    return value")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __enhanceAttioQueryResult<TObject extends GeneratedAttioObject>(object: TObject, result: AttioRecordsResult): AttioQueryRecordsResult<TObject> {")
        attioRuntimeHelperLines.push("    const records = (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>")
        attioRuntimeHelperLines.push("    return { records, count: records.length, offset: result.offset ?? 0 }")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __enhanceAttioSearchResult(result: AttioRecordsResult): AttioSearchRecordsResult {")
        attioRuntimeHelperLines.push("    const matches = result.matches ?? []")
        attioRuntimeHelperLines.push("    return { matches, count: matches.length }")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __enhanceAttioUpsertResult<TObject extends GeneratedAttioObject>(object: TObject, result: AttioRecordsResult): AttioUpsertRecordResult<TObject> {")
        attioRuntimeHelperLines.push("    const records = (result.records || []).map(record => __enhanceAttioRecord(object, record)).filter(Boolean) as Array<AttioRecordFor<TObject>>")
        attioRuntimeHelperLines.push("    return { records, count: records.length }")
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
        attioRuntimeHelperLines.push("function __enhanceAttioSingleRecordResult<TObject extends GeneratedAttioObject>(object: TObject, result: AttioRecordsResult): AttioSingleRecordResult<TObject> {")
        attioRuntimeHelperLines.push('    return __requireAttioPayload(__enhanceAttioRecord(object, result.record), "record")')
        attioRuntimeHelperLines.push("}")
        attioRuntimeHelperLines.push("")
    }

    const hasPosthogEventNames = (input.posthog[0]?.projects ?? []).some(project => project.events.length > 0)

    // Custom events type-check against the generated union; $-prefixed builtins are always allowed
    const posthogEventNameOverride = "PosthogEventName | `$${string}` | null"

    const printedToolTypes = await Promise.all(
        tools
            .filter(tool => !isAttioTool(tool))
            .map(async tool => {
                const name = tool.name
                if (!isKnownToolName(name)) return undefined
                const definition = ToolDefinitions[name]
                const paramsDeclaration = await printType({
                    typeName: toolNameToTypeName(name, "Params"),
                    schema: definition.inputSchema,
                    io: "input",
                    description: tool.description || undefined,
                    omitFields: hasAutoFillId(tool) ? ["integrationId"] : undefined,
                    fieldOverrides: name === "searchPosthogEvents" && hasPosthogEventNames ? { eventName: posthogEventNameOverride } : undefined
                })
                const resultDeclaration = await printType({
                    typeName: toolNameToTypeName(name, "Result"),
                    schema: definition.outputSchema,
                    io: "output",
                    hoisted: hoistedShapes
                })
                return { key: tool.integration.toLowerCase(), declarations: [paramsDeclaration, resultDeclaration] }
            })
    )
    const declarationsByKey = new Map<string, string[]>()
    for (const printed of printedToolTypes) {
        if (!printed) continue
        declarationsByKey.set(printed.key, [...(declarationsByKey.get(printed.key) ?? []), ...printed.declarations])
    }
    const commonToolDeclarations = [await printHoistedShape(hoistedShapes[0], "output")]

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

    const toolFiles: Record<string, ToolFileContext> = {}
    const toolboxEntries: ToolboxEntryContext[] = []
    rawGroups.forEach(group => {
        const entry: ToolboxEntryContext = {
            key: group.key,
            integrationType: toolIntegrationToIntegrationType(group.integration),
            typeName: `${toPascalCase(group.key)}GeneratedTools`,
            constName: `${toCamelCase(group.key)}Tools`
        }
        toolboxEntries.push(entry)
        toolFiles[group.key] = {
            ...entry,
            declarations: declarationsByKey.get(group.key) ?? [],
            methods: group.tools.flatMap(tool => {
                const methodName = toCamelCase(tool.displayName)
                const paramsType = toolNameToTypeName(tool.name, "Params")
                const resultType = toolNameToTypeName(tool.name, "Result")
                const normalizedParamsExpr = group.integration === "github" ? normalizeGitHubReposParams(tool.name) : "params"

                if (group.integration === "attio" && group.integrationId) {
                    const attioMethods = buildAttioToolMethods(group.integrationId, tool)
                    if (attioMethods) return attioMethods
                }

                const generatedSignature = `${methodName}(params: ${paramsType}): Promise<${resultType}>`

                let runtimeLines: string[]
                if (group.integrationId && hasAutoFillId(tool)) {
                    runtimeLines = [
                        `${methodName}: (params: ${paramsType}) =>`,
                        `    TerseAgent.executeTool<${resultType}>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}), integrationId: "${escapeString(group.integrationId)}" }),`
                    ]
                } else {
                    runtimeLines = [`${methodName}: (params: ${paramsType}) =>`, `    TerseAgent.executeTool<${resultType}>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}) }),`]
                }

                return [
                    {
                        description: tool.description || undefined,
                        generatedSignature,
                        runtimeLines
                    }
                ]
            })
        }
    })

    return {
        imports,
        data: {
            toolFiles,
            toolboxEntries,
            commonToolDeclarations,
            attioSchemaLines,
            attioRuntimeHelperLines,
            githubRepoMappings
        }
    }
}

function buildAttioRecordsMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    const call = (requestExpr: string) => `TerseAgent.executeTool<${attioOutputTypeName(toolName)}>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })`
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

// Each method narrows the wire result to its action's payload at runtime: singles unwrap to the bare
// entity (throwing if absent), lists rebuild a { items, count, nextCursor? } wrapper, deletes resolve void.
function attioResultParts(toolName: string, result: AttioResultSpec): { resultType: string; thenExpr: string } {
    const base = attioOutputTypeName(toolName)
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
        const paramsType = attioMethodParamsTypeName(spec.methodName)
        const requestExpr = spec.action ? `{ action: "${spec.action}", ...params }` : "params"
        const { resultType, thenExpr } = attioResultParts(toolName, spec.result)
        return {
            description: spec.action ? attioActionDescription(toolName, spec.action) : tool.description || undefined,
            generatedSignature: `${spec.methodName}(${spec.emptyParams ? `params?: ${paramsType}` : `params: ${paramsType}`}): Promise<${resultType}>`,
            runtimeLines: [
                `${spec.methodName}: (params: ${paramsType}${spec.emptyParams ? " = {}" : ""}) =>`,
                `    TerseAgent.executeTool<${attioOutputTypeName(toolName)}>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })${thenExpr},`
            ]
        }
    })
}

function buildAttioListsMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    const call = (requestExpr: string) => `TerseAgent.executeTool<${attioOutputTypeName(toolName)}>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })`
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
                    generatedSignature: `createList(params: ${attioMethodParamsTypeName("createList")}): Promise<NonNullable<AttioListsResult["list"]>>`,
                    runtimeLines: [`createList: (params: ${attioMethodParamsTypeName("createList")}) =>`, `    ${call("params")}.then(result => __requireAttioPayload(result.list, "list")),`]
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

export async function prepareTemplateContext(input: CodegenInput): Promise<TemplateContext> {
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
    const attio = await prepareAttioSection(active.attio, input.tools)
    const snowflake = prepareSnowflakeSection(active.snowflake, input.tools)
    const heyreach = prepareHeyReachSection(active.heyreach)
    const tools = await prepareToolsSection(input.tools, input, active)
    const system = prepareSystemSection()

    const sections = [github, gmail, slack, linear, notion, posthog, datadog, launchdarkly, workos, attio, snowflake, heyreach, tools, system]

    for (const section of sections) {
        section.imports.forEach(value => allImports.add(value))
    }

    const triggerTypes = await buildTriggerTypeDeclarations(allImports)
    triggerTypes.declaredNames.forEach(name => allImports.delete(name))
    if (triggerTypes.declaredNames.size > 0) allImports.add("SDKTrigger")
    triggerTypes.extraImports.forEach(name => allImports.add(name))

    const imports = [...allImports].sort()

    const { common: commonTriggerDeclarations = [], ...triggerFiles } = triggerTypes.declarationsByIntegration

    return {
        imports,
        useMultilineImports: imports.length > 3,
        availableIntegrations: input.availableIntegrations.length > 0 ? input.availableIntegrations.join(", ") : undefined,
        toolboxEntries: tools.data?.toolboxEntries ?? [],
        toolFiles: tools.data?.toolFiles ?? {},
        triggerFiles,
        commonTriggerDeclarations,
        commonToolDeclarations: tools.data?.commonToolDeclarations ?? [],
        attioSchemaLines: tools.data?.attioSchemaLines ?? [],
        attioRuntimeHelperLines: tools.data?.attioRuntimeHelperLines ?? [],
        githubRepoMappings: tools.data?.githubRepoMappings ?? [],
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
        heyreach: selectActiveInstance(input.heyreach, pins[IntegrationType.HEY_REACH], data => data.id)
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
}
