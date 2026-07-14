import { type IntegrationType, type TriggerDefinition, TriggerDefinitions, isBuiltInIntegrationType, isTriggerDefinitionName } from "terse-types"

import { printType } from "./typePrinter.js"

export async function buildTriggerTypeDeclarations(presentBuckets: ReadonlySet<string>): Promise<TriggerTypeDeclarations> {
    const entries = Object.keys(TriggerDefinitions)
        .filter(isTriggerDefinitionName)
        .flatMap(name => {
            const definition: TriggerDefinition = TriggerDefinitions[name]
            const bucket = bucketForIntegration(definition.integration)
            if (bucket !== "common" && !presentBuckets.has(bucket)) return []
            return [{ name, definition, bucket }]
        })

    const declarationsByIntegration: Record<string, string[]> = {}
    for (const entry of entries) {
        const declaration = await renderDeclaration(entry.name, entry.definition)
        declarationsByIntegration[entry.bucket] = [...(declarationsByIntegration[entry.bucket] ?? []), declaration]
    }

    const extraImports = entries.flatMap(entry => [...(entry.definition.kind === "concrete" ? (entry.definition.printHints?.imports ?? []) : [])])
    return {
        declaredNames: new Set(entries.map(entry => entry.name)),
        declarationsByIntegration,
        extraImports: [...new Set(extraImports)]
    }
}

function bucketForIntegration(integration: IntegrationType): string {
    return isBuiltInIntegrationType(integration) ? "common" : integration
}

async function renderDeclaration(name: string, definition: TriggerDefinition): Promise<string> {
    if (definition.kind === "union") {
        return `export type ${name} = ${definition.members.join(" | ")}`
    }
    const hints = definition.printHints
    const payloadName = `${name}Payload`
    const payloadInterface = await printType({
        typeName: payloadName,
        schema: definition.schema,
        io: "output",
        fieldOverrides: hints?.fieldOverrides,
        typeParams: hints?.typeParams
    })
    const alias = `export type ${name}${hints?.typeParams ?? ""} = SDKTrigger<${payloadName}${hints?.aliasArgs ?? ""}>`
    return `${payloadInterface}\n\n${alias}`
}

export type TriggerTypeDeclarations = {
    readonly declaredNames: ReadonlySet<string>
    readonly declarationsByIntegration: Readonly<Record<string, string[]>>
    readonly extraImports: readonly string[]
}
