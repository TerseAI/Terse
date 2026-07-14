import { type IntegrationType, type TriggerDefinition, TriggerDefinitions, isBuiltInIntegrationType, isTriggerDefinitionName } from "terse-types"

import { printType } from "./typePrinter.js"

export async function buildTriggerDeclarationsForBucket(bucket: string): Promise<BucketTriggerDeclarations> {
    const entries = Object.keys(TriggerDefinitions)
        .filter(isTriggerDefinitionName)
        .flatMap(name => {
            const definition: TriggerDefinition = TriggerDefinitions[name]
            if (bucketForIntegration(definition.integration) !== bucket) return []
            return [{ name, definition }]
        })

    const declarations: string[] = []
    for (const entry of entries) {
        declarations.push(await renderDeclaration(entry.name, entry.definition))
    }

    const extraImports = entries.flatMap(entry => [...(entry.definition.kind === "concrete" ? (entry.definition.printHints?.imports ?? []) : [])])
    return {
        declarations,
        declaredNames: entries.map(entry => entry.name),
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

export type BucketTriggerDeclarations = {
    readonly declarations: readonly string[]
    readonly declaredNames: readonly string[]
    readonly extraImports: readonly string[]
}
