import type { AttioAttributeData, AttioInstanceData, CodegenInput, SlackInstanceData, SnowflakeInstanceData, ToolDefinition } from "../codegenTypes.js"

const SUPPORTED_TOOL_SPECS = [
    ["attio", "attio_list_objects", "list_objects"],
    ["attio", "attio_query_records", "query_records"],
    ["attio", "attio_upsert_record", "upsert_record"],
    ["slack", "slack_send_message", "send_message"],
    ["slack", "slack_list_channels", "list_channels"],
    ["slack", "slack_list_users", "list_users"],
    ["slack", "slack_read_conversation", "read_conversation"],
    ["snowflake", "snowflakeExecuteQuery", "execute_query"],
    ["snowflake", "snowflakeExplainQuery", "explain_query"]
] as const

const SUPPORTED_TOOL_NAMES = new Set<string>(SUPPORTED_TOOL_SPECS.map(([, toolName]) => toolName))

const TOOL_METHOD_NAME_BY_TOOL = Object.fromEntries(SUPPORTED_TOOL_SPECS.map(([, toolName, methodName]) => [toolName, methodName])) as Record<string, string>

const TOOL_NAME_ALIASES: Record<string, string> = {
    snowflake_execute_query: "snowflakeExecuteQuery",
    snowflake_explain_query: "snowflakeExplainQuery"
}

const TOOL_OUTPUT_MODEL_BY_TOOL: Record<string, string> = {
    attio_list_objects: "AttioListObjectsToolOutput",
    attio_query_records: "AttioQueryRecordsToolOutput",
    attio_upsert_record: "AttioUpsertRecordToolOutput",
    slack_send_message: "SlackSendMessageToolOutput",
    slack_list_channels: "SlackListChannelsToolOutput",
    slack_list_users: "SlackListUsersToolOutput",
    slack_read_conversation: "SlackReadConversationToolOutput",
    snowflakeExecuteQuery: "SnowflakeExecuteQueryToolOutput",
    snowflakeExplainQuery: "SnowflakeExplainQueryToolOutput"
}

export interface PythonToolCtx {
    name: string
    nameRepr: string
    methodName: string
    outputModel: string
    approvable: boolean
}

export interface PythonAttioAttrCtx {
    apiSlug: string
    recordType: string
    inputType: string
    filterType: string
}

export interface PythonAttioObjectCtx {
    apiSlug: string
    apiSlugRepr: string
    singularNoun: string
    singularNounRepr: string
    pascal: string
    staticName: string
    attributes: PythonAttioAttrCtx[]
    hasAttributes: boolean
    attrSlugsLiteral: string
    attrSlugsFrozensetRepr: string
    multiValueSlugs: string[]
    hasMultiValueSlugs: boolean
    multiValueFrozensetRepr: string
    attributeTupleRepr: string
    recordValuesTypeName: string
    inputValuesTypeName: string
    attributeSlugTypeName: string
    filterTypeName: string
    staticDeclaration: string
}

export interface PythonAttioCtx {
    instanceIdRepr: string
    hasAttrs: boolean
    objects: PythonAttioObjectCtx[]
    tools: PythonToolCtx[]
    approvableTools: PythonToolCtx[]
    skillToolType: string
    skillObjectType: string
}

export interface PythonSnowflakeCtx {
    instanceIdRepr: string
    tools: PythonToolCtx[]
    approvableTools: PythonToolCtx[]
    skillToolType: string
}

export interface PythonSlackChannelCtx {
    staticName: string
    channelIdRepr: string
    nameRepr: string
}

export interface PythonSlackCtx {
    instanceIdRepr: string
    channels: PythonSlackChannelCtx[]
    tools: PythonToolCtx[]
    approvableTools: PythonToolCtx[]
    skillToolType: string
}

export interface PythonTemplateContext {
    attio: PythonAttioCtx | null
    slack: PythonSlackCtx | null
    snowflake: PythonSnowflakeCtx | null
    hasAttio: boolean
    hasAttioAttrs: boolean
    hasAttioTools: boolean
    hasSlack: boolean
    hasSlackTools: boolean
    hasSnowflake: boolean
    hasSnowflakeTools: boolean
    hasAnyToolNameTypes: boolean
    hasAnyDeterministicTools: boolean
    sdkImports: string[]
    typingImportsLine?: string
    pydanticImportsLine?: string
    needsJsonImport: boolean
    attioToolNamesLiteral?: string
    slackToolNamesLiteral?: string
    snowflakeToolNamesLiteral?: string
    allToolNamesLiteral?: string
    exportedNamesRepr: string
}

export function preparePythonTemplateContext(input: CodegenInput): PythonTemplateContext {
    const attioTools = selectSupportedTools(input.tools, "attio")
    const slackTools = selectSupportedTools(input.tools, "slack")
    const snowflakeTools = selectSupportedTools(input.tools, "snowflake")

    const attio = input.attio[0] ? buildAttioCtx(input.attio[0], attioTools) : null
    const slack = input.slack[0] ? buildSlackCtx(input.slack[0], slackTools) : null
    const snowflake = input.snowflake[0] ? buildSnowflakeCtx(input.snowflake[0], snowflakeTools) : null

    const hasAttio = attio !== null
    const hasAttioAttrs = !!attio?.hasAttrs
    const hasAttioTools = (attio?.tools.length ?? 0) > 0
    const hasSlack = slack !== null
    const hasSlackTools = (slack?.tools.length ?? 0) > 0
    const hasSnowflake = snowflake !== null
    const hasSnowflakeTools = (snowflake?.tools.length ?? 0) > 0
    const hasAnyToolNameTypes = (attio?.approvableTools.length ?? 0) > 0 || (slack?.approvableTools.length ?? 0) > 0 || (snowflake?.approvableTools.length ?? 0) > 0
    const hasAnyDeterministicTools = hasAttioTools || hasSlackTools || hasSnowflakeTools

    const sdkImports = ["SkillConfig", "TerseAgent as _SdkTerseAgent", "TriggerConfig"]
    if (hasSlack) {
        sdkImports.push("SlackEventType")
    }
    if (hasAttioAttrs && hasAttioTools) {
        sdkImports.push("AttioTypedQueryResult", "AttioTypedRecord", "AttioTypedUpsertResult")
    }
    for (const tool of [...(attio?.tools ?? []), ...(slack?.tools ?? []), ...(snowflake?.tools ?? [])]) {
        pushUnique(sdkImports, tool.outputModel)
    }

    const typingImports = new Set<string>()
    if (hasAttioAttrs) {
        for (const name of ["Any", "Generic", "Sequence", "TypeVar", "TypedDict", "cast"]) {
            typingImports.add(name)
        }
    }
    if (hasSlack) {
        typingImports.add("ClassVar")
        typingImports.add("Sequence")
    }
    if (hasAnyToolNameTypes) {
        typingImports.add("Literal")
    }
    const typingImportsLine = typingImports.size ? `from typing import ${Array.from(typingImports).sort().join(", ")}` : undefined

    const pydanticImportsLine = hasAttio || hasSlack ? "from pydantic import BaseModel, ConfigDict" : undefined

    const exportedNames = buildExportedNames(attio, slack, snowflake)

    return {
        attio,
        slack,
        snowflake,
        hasAttio,
        hasAttioAttrs,
        hasAttioTools,
        hasSlack,
        hasSlackTools,
        hasSnowflake,
        hasSnowflakeTools,
        hasAnyToolNameTypes,
        hasAnyDeterministicTools,
        sdkImports,
        typingImportsLine,
        pydanticImportsLine,
        needsJsonImport: hasAttioTools || hasSlackTools,
        attioToolNamesLiteral: attio?.approvableTools.length ? buildToolNamesLiteral(attio.approvableTools) : undefined,
        slackToolNamesLiteral: slack?.approvableTools.length ? buildToolNamesLiteral(slack.approvableTools) : undefined,
        snowflakeToolNamesLiteral: snowflake?.approvableTools.length ? buildToolNamesLiteral(snowflake.approvableTools) : undefined,
        allToolNamesLiteral: hasAnyToolNameTypes ? buildToolNamesLiteral([...(attio?.approvableTools ?? []), ...(slack?.approvableTools ?? []), ...(snowflake?.approvableTools ?? [])]) : undefined,
        exportedNamesRepr: pyListRepr(exportedNames)
    }
}

export function pyRepr(value: string): string {
    let result = "'"
    for (const char of value) {
        switch (char) {
            case "\\":
                result += "\\\\"
                break
            case "'":
                result += "\\'"
                break
            case "\n":
                result += "\\n"
                break
            case "\r":
                result += "\\r"
                break
            case "\t":
                result += "\\t"
                break
            default: {
                const code = char.charCodeAt(0)
                result += code < 32 ? `\\x${code.toString(16).padStart(2, "0")}` : char
                break
            }
        }
    }
    return `${result}'`
}

export function pyListRepr(values: string[]): string {
    return `[${values.map(pyRepr).join(", ")}]`
}

function buildAttioCtx(instance: AttioInstanceData, tools: ToolDefinition[]): PythonAttioCtx {
    const hasAttrs = instance.objects.some(obj => (obj.attributes?.length ?? 0) > 0)
    const usedNames = new Set<string>()
    const objects = instance.objects.map(obj => buildAttioObjectCtx(obj, usedNames, hasAttrs))
    const toolContexts = tools.map(buildToolCtx)

    return {
        instanceIdRepr: pyRepr(instance.id),
        hasAttrs,
        objects,
        tools: toolContexts,
        approvableTools: toolContexts.filter(tool => tool.approvable),
        skillToolType: toolContexts.some(tool => tool.approvable) ? "AttioToolNames" : "str",
        skillObjectType: hasAttrs ? "AttioObjectType[Any, Any, Any, Any]" : "AttioObjectType"
    }
}

function buildSnowflakeCtx(instance: SnowflakeInstanceData, tools: ToolDefinition[]): PythonSnowflakeCtx {
    const toolContexts = tools.map(buildToolCtx)
    return {
        instanceIdRepr: pyRepr(instance.id),
        tools: toolContexts,
        approvableTools: toolContexts.filter(tool => tool.approvable),
        skillToolType: toolContexts.some(tool => tool.approvable) ? "SnowflakeToolNames" : "str"
    }
}

function buildSlackCtx(instance: SlackInstanceData, tools: ToolDefinition[]): PythonSlackCtx {
    const toolContexts = tools.map(buildToolCtx)
    const usedNames = new Set<string>()
    const channels = instance.channels.map(channel => ({
        staticName: uniqueName(toPascalCase(channel.name || "Channel") || "Channel", usedNames),
        channelIdRepr: pyRepr(channel.id),
        nameRepr: pyRepr(channel.name)
    }))

    return {
        instanceIdRepr: pyRepr(instance.id),
        channels,
        tools: toolContexts,
        approvableTools: toolContexts.filter(tool => tool.approvable),
        skillToolType: toolContexts.some(tool => tool.approvable) ? "SlackToolNames" : "str"
    }
}

function buildAttioObjectCtx(obj: AttioInstanceData["objects"][number], usedNames: Set<string>, hasAttrs: boolean): PythonAttioObjectCtx {
    const pascal = toPascalCase(obj.singular_noun || obj.api_slug) || "Object"
    const staticName = uniqueName(pascal, usedNames)
    const attributes = (obj.attributes ?? []).map(attr => ({
        apiSlug: attr.api_slug ?? "",
        recordType: attioRecordPythonType(attr),
        inputType: attioInputPythonType(attr),
        filterType: attioFilterPythonType(attr)
    }))
    const attrSlugsLiteral = attributes.length ? attributes.map(attr => pyRepr(attr.apiSlug)).join(", ") : "''"
    const attrSlugsFrozensetRepr = attributes.length ? `frozenset({${attributes.map(attr => pyRepr(attr.apiSlug)).join(", ")}})` : "frozenset()"
    const multiValueSlugs = (obj.attributes ?? [])
        .filter(attr => isAttioMultiValue(attr))
        .map(attr => attr.api_slug ?? "")
        .filter(Boolean)
    const multiValueFrozensetRepr = multiValueSlugs.length ? `frozenset({${multiValueSlugs.map(pyRepr).join(", ")}})` : "frozenset()"

    const recordValuesTypeName = `${pascal}RecordValues`
    const inputValuesTypeName = `${pascal}InputValues`
    const attributeSlugTypeName = `${pascal}AttributeSlug`
    const filterTypeName = `${pascal}Filter`
    const hasAttributes = attributes.length > 0

    const staticDeclaration =
        hasAttrs && hasAttributes
            ? `${staticName}: AttioObjectType[${attributeSlugTypeName}, ${recordValuesTypeName}, ${inputValuesTypeName}, ${filterTypeName}] = AttioObjectType(api_slug=${pyRepr(obj.api_slug)}, name=${pyRepr(obj.singular_noun)}, attributes=${renderAttributeTuple(obj.attributes ?? [])})`
            : `${staticName} = AttioObjectType(api_slug=${pyRepr(obj.api_slug)}, name=${pyRepr(obj.singular_noun)})`

    return {
        apiSlug: obj.api_slug,
        apiSlugRepr: pyRepr(obj.api_slug),
        singularNoun: obj.singular_noun,
        singularNounRepr: pyRepr(obj.singular_noun),
        pascal,
        staticName,
        attributes,
        hasAttributes,
        attrSlugsLiteral,
        attrSlugsFrozensetRepr,
        multiValueSlugs,
        hasMultiValueSlugs: multiValueSlugs.length > 0,
        multiValueFrozensetRepr,
        attributeTupleRepr: renderAttributeTuple(obj.attributes ?? []),
        recordValuesTypeName,
        inputValuesTypeName,
        attributeSlugTypeName,
        filterTypeName,
        staticDeclaration
    }
}

function buildToolCtx(tool: ToolDefinition): PythonToolCtx {
    const normalizedName = canonicalToolName(tool.name)
    return {
        name: normalizedName,
        nameRepr: pyRepr(normalizedName),
        methodName: TOOL_METHOD_NAME_BY_TOOL[normalizedName],
        outputModel: TOOL_OUTPUT_MODEL_BY_TOOL[normalizedName],
        approvable: !tool.isReadOnly || tool.supportsApproval
    }
}

function buildToolNamesLiteral(tools: PythonToolCtx[]): string {
    return tools.map(tool => tool.nameRepr).join(", ")
}

function buildExportedNames(attio: PythonAttioCtx | null, slack: PythonSlackCtx | null, snowflake: PythonSnowflakeCtx | null): string[] {
    const names = ["Schedule", "GeneratedTools", "create_tools", "attach_tools", "TerseAgent"]

    for (const tool of [...(attio?.tools ?? []), ...(slack?.tools ?? []), ...(snowflake?.tools ?? [])]) {
        pushUnique(names, tool.outputModel)
    }

    if ((attio?.approvableTools.length ?? 0) > 0) names.push("AttioToolNames")
    if ((slack?.approvableTools.length ?? 0) > 0) names.push("SlackToolNames")
    if ((snowflake?.approvableTools.length ?? 0) > 0) names.push("SnowflakeToolNames")
    if ((attio?.approvableTools.length ?? 0) > 0 || (slack?.approvableTools.length ?? 0) > 0 || (snowflake?.approvableTools.length ?? 0) > 0) {
        names.push("AllToolNames")
    }

    if (attio) {
        names.push("AttioAttributeDefinition", "AttioObjectType", "AttioObjects", "Attio")
        if (attio.hasAttrs) {
            for (const obj of attio.objects) {
                if (!obj.hasAttributes) continue
                names.push(obj.recordValuesTypeName, obj.inputValuesTypeName, obj.filterTypeName, obj.attributeSlugTypeName)
            }
        }
    } else {
        names.push("Attio")
    }

    names.push("Slack", "SlackChannel")
    names.push("Snowflake")
    return names
}

function isAttioMultiValue(attr: AttioAttributeData): boolean {
    const slug = (attr.api_slug ?? "").toLowerCase()
    const type = (attr.type ?? "").toLowerCase()

    return (
        type.includes("multi") ||
        type.includes("array") ||
        type.includes("list") ||
        ["email_addresses", "domains", "phone_numbers", "social_profiles", "links", "tags"].includes(slug) ||
        slug.endsWith("_addresses") ||
        slug.endsWith("_ids")
    )
}

function attioBasePythonType(attr: AttioAttributeData): string {
    const type = (attr.type ?? "").toLowerCase()
    const slug = (attr.api_slug ?? "").toLowerCase()

    if (type.includes("checkbox") || type.includes("boolean")) return "bool"
    if (["number", "currency", "rating", "percent"].some(keyword => type.includes(keyword))) return "float"
    if (["date", "time", "email", "domain", "phone", "url", "select", "status", "text", "string", "name"].some(keyword => type.includes(keyword))) {
        return "str"
    }
    if (["location", "address", "reference", "record", "actor"].some(keyword => type.includes(keyword))) {
        return "dict[str, Any]"
    }
    if (["email_addresses", "domains", "phone_numbers", "name"].includes(slug)) return "str"
    return "Any"
}

function attioRecordPythonType(attr: AttioAttributeData): string {
    const baseType = attioBasePythonType(attr)
    return isAttioMultiValue(attr) ? `list[${baseType}]` : baseType
}

function attioInputPythonType(attr: AttioAttributeData): string {
    const baseType = attioBasePythonType(attr)
    return isAttioMultiValue(attr) ? `${baseType} | list[${baseType}]` : baseType
}

function attioFilterPythonType(attr: AttioAttributeData): string {
    const valueType = attioBasePythonType(attr)
    return valueType === "Any" || valueType === "dict[str, Any]" ? "dict[str, Any]" : `${valueType} | dict[str, Any]`
}

function renderAttributeTuple(attributes: AttioAttributeData[]): string {
    if (attributes.length === 0) return "()"

    const parts = attributes.map(attr => {
        const args = [`api_slug=${pyRepr(attr.api_slug ?? "")}`]
        if (attr.title) args.push(`title=${pyRepr(attr.title)}`)
        if (attr.type) args.push(`type=${pyRepr(attr.type)}`)
        if (attr.is_required) args.push("is_required=True")
        if (attr.is_unique) args.push("is_unique=True")
        return `AttioAttributeDefinition(${args.join(", ")})`
    })

    return `(${parts.join(", ")},)`
}

function selectSupportedTools(tools: ToolDefinition[], integration: string): ToolDefinition[] {
    const available = new Map<string, ToolDefinition>()

    for (const tool of tools) {
        if (tool.integration !== integration) continue
        const normalizedName = canonicalToolName(tool.name)
        if (!SUPPORTED_TOOL_NAMES.has(normalizedName)) continue
        available.set(normalizedName, { ...tool, name: normalizedName })
    }

    const ordered: ToolDefinition[] = []
    for (const [supportedIntegration, toolName] of SUPPORTED_TOOL_SPECS) {
        if (supportedIntegration !== integration) continue
        const tool = available.get(toolName)
        if (tool) ordered.push(tool)
    }
    return ordered
}

function canonicalToolName(toolName: string): string {
    return TOOL_NAME_ALIASES[toolName] ?? toolName
}

function toPascalCase(value: string): string {
    const normalized = value
        .split(/[^0-9A-Za-z]+/)
        .filter(Boolean)
        .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join("")

    return /^\d/.test(normalized) ? `_${normalized}` : normalized
}

function uniqueName(candidate: string, usedNames: Set<string>): string {
    if (!usedNames.has(candidate)) {
        usedNames.add(candidate)
        return candidate
    }

    let index = 2
    while (usedNames.has(`${candidate}${index}`)) index++

    const unique = `${candidate}${index}`
    usedNames.add(unique)
    return unique
}

function pushUnique(values: string[], value: string): void {
    if (!values.includes(value)) values.push(value)
}
