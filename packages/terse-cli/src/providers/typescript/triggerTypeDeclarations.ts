import { type TriggerDefinitionName, TriggerDefinitions, isTriggerDefinitionName } from "terse-types"
import { z } from "zod"

import { printType } from "./typePrinter.js"

export async function buildTriggerTypeDeclarations(requestedNames: ReadonlySet<string>): Promise<TriggerTypeDeclarations> {
    const names = resolveWithDependencies(requestedNames)
    const declarations = await Promise.all(names.map(renderDeclaration))
    const declarationsByIntegration: Record<string, string[]> = {}
    names.forEach((name, index) => {
        const integration = integrationForTriggerType(name)
        declarationsByIntegration[integration] = [...(declarationsByIntegration[integration] ?? []), declarations[index]]
    })
    const extraImports = names.flatMap(name => [...(TRIGGER_PRESENTATIONS[name]?.imports ?? [])])
    return {
        declaredNames: new Set(names),
        declarationsByIntegration,
        extraImports: [...new Set(extraImports)]
    }
}

function integrationForTriggerType(name: string): string {
    const prefixes: Array<[string, string]> = [
        ["Slack", "slack"],
        ["Github", "github"],
        ["Gmail", "gmail"],
        ["Linear", "linear"],
        ["WorkOS", "workos"],
        ["HeyReach", "heyreach"],
        ["Attio", "attio"]
    ]
    const match = prefixes.find(([prefix]) => name.startsWith(prefix))
    return match ? match[1] : "common"
}

async function renderDeclaration(name: TriggerDefinitionName): Promise<string> {
    const memberNames = unionMemberNames(TriggerDefinitions[name])
    if (memberNames) {
        return `export type ${name} = ${memberNames.join(" | ")}`
    }
    const presentation = TRIGGER_PRESENTATIONS[name]
    const payloadName = `${name}Payload`
    const payloadInterface = await printType({
        typeName: payloadName,
        schema: TriggerDefinitions[name],
        io: "output",
        fieldOverrides: presentation?.fieldOverrides,
        typeParams: presentation?.typeParams
    })
    const alias = `export type ${name}${presentation?.typeParams ?? ""} = SDKTrigger<${payloadName}${presentation?.aliasArgs ?? ""}>`
    return `${payloadInterface}\n\n${alias}`
}

function resolveWithDependencies(requestedNames: ReadonlySet<string>): TriggerDefinitionName[] {
    const included = new Set<TriggerDefinitionName>()
    const include = (name: string): void => {
        if (!isTriggerDefinitionName(name) || included.has(name)) return
        included.add(name)
        unionMemberNames(TriggerDefinitions[name])?.forEach(include)
    }
    requestedNames.forEach(include)
    return Object.keys(TriggerDefinitions)
        .filter(isTriggerDefinitionName)
        .filter(name => included.has(name))
}

// A registered schema prints as a union alias only when every option is itself a registered schema;
// anything else goes through the payload printer.
function unionMemberNames(schema: z.ZodType): TriggerDefinitionName[] | undefined {
    if (!(schema instanceof z.ZodUnion)) return undefined
    const memberNames = schema.options.flatMap(option => {
        const name = NAME_BY_SCHEMA.get(option)
        return name ? [name] : []
    })
    return memberNames.length === schema.options.length ? memberNames : undefined
}

const NAME_BY_SCHEMA = new Map<z.core.$ZodType, TriggerDefinitionName>(
    Object.keys(TriggerDefinitions)
        .filter(isTriggerDefinitionName)
        .map(name => [TriggerDefinitions[name], name])
)

const SLACK_PRESENTATION: TriggerPresentation = {
    fieldOverrides: {
        blocks: "SlackBlocks | null",
        attachments: "SlackAttachments | null",
        files: "SlackFiles | null"
    },
    imports: ["SlackBlocks", "SlackAttachments", "SlackFiles"]
}

const ATTIO_RECORD_PRESENTATION: TriggerPresentation = {
    typeParams: "<TValues = Record<string, unknown>>",
    aliasArgs: "<TValues>",
    fieldOverrides: { "record.values": "TValues" }
}

const TRIGGER_PRESENTATIONS: Partial<Record<TriggerDefinitionName, TriggerPresentation>> = {
    SlackMessageTrigger: SLACK_PRESENTATION,
    SlackAppMentionTrigger: SLACK_PRESENTATION,
    SlackReactionAddedTrigger: SLACK_PRESENTATION,
    AttioRecordCreatedTrigger: ATTIO_RECORD_PRESENTATION,
    AttioRecordMergedTrigger: ATTIO_RECORD_PRESENTATION,
    AttioRecordUpdatedTrigger: ATTIO_RECORD_PRESENTATION,
    WebhookTrigger: { typeParams: "<TBody = unknown>", aliasArgs: "<TBody>", fieldOverrides: { body: "TBody" } },
    WebMonitorTrigger: { typeParams: "<TStructured = unknown>", aliasArgs: "<TStructured>", fieldOverrides: { payload: "TStructured" } }
}

export type TriggerTypeDeclarations = {
    readonly declaredNames: ReadonlySet<string>
    readonly declarationsByIntegration: Readonly<Record<string, string[]>>
    readonly extraImports: readonly string[]
}

type TriggerPresentation = {
    readonly typeParams?: string
    readonly aliasArgs?: string
    readonly fieldOverrides?: Readonly<Record<string, string>>
    readonly imports?: readonly string[]
}
