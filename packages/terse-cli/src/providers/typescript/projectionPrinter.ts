import { compile } from "json-schema-to-typescript"
import { z } from "zod"

/**
 * Prints a zod schema as a fully resolved, human-readable TypeScript declaration
 * ("projected type") for terse.generated.ts. Field `.describe()` texts survive as JSDoc.
 */
export async function printProjectedType(options: ProjectionOptions): Promise<string> {
    const jsonSchema = toJsonSchema(options.schema, options.io)

    if (options.omitFields) omitFields(jsonSchema, options.omitFields)
    if (options.hoisted) replaceHoistedShapes(jsonSchema, buildHoistedMatchers(options.hoisted, options.io))
    if (options.fieldOverrides) applyFieldOverrides(jsonSchema, options.fieldOverrides)

    const compiled = await compile(structuredClone(jsonSchema), options.typeName, {
        bannerComment: "",
        additionalProperties: false,
        format: true,
        style: { tabWidth: 4, semi: false, printWidth: 120 }
    })

    let declaration = compiled.trim()
    if (options.typeParams) declaration = addTypeParams(declaration, options.typeName, options.typeParams)
    if (options.description) declaration = `/** ${options.description} */\n${declaration}`
    return declaration
}

export function projectionTypeName(toolName: string, suffix: "Params" | "Result"): string {
    return (
        toolName
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join("") + suffix
    )
}

function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchemaNode {
    const jsonSchema = z.toJSONSchema(schema, {
        io,
        unrepresentable: "any",
        reused: "inline",
        override: ctx => {
            if (ctx.zodSchema._zod.def.type === "date") {
                ctx.jsonSchema.tsType = "Date"
            }
        }
    }) as JsonSchemaNode
    delete jsonSchema.$schema
    return jsonSchema
}

function omitFields(jsonSchema: JsonSchemaNode, fields: string[]): void {
    const properties = jsonSchema.properties
    if (!properties) return
    for (const field of fields) {
        delete properties[field]
    }
    if (jsonSchema.required) {
        jsonSchema.required = jsonSchema.required.filter(name => !fields.includes(name))
    }
}

function buildHoistedMatchers(hoisted: HoistedProjection[], io: "input" | "output"): Array<{ name: string; matcher: string }> {
    return hoisted.map(entry => ({ name: entry.name, matcher: stableStringify(toJsonSchema(entry.schema, io)) }))
}

function replaceHoistedShapes(node: unknown, matchers: Array<{ name: string; matcher: string }>): void {
    if (typeof node !== "object" || node === null) return

    for (const [key, child] of Object.entries(node)) {
        if (typeof child !== "object" || child === null) continue
        const match = matchers.find(entry => stableStringify(child) === entry.matcher)
        if (match) {
            ;(node as Record<string, unknown>)[key] = { tsType: match.name }
        } else {
            replaceHoistedShapes(child, matchers)
        }
    }
}

function applyFieldOverrides(jsonSchema: JsonSchemaNode, overrides: Record<string, string>): void {
    for (const [path, tsType] of Object.entries(overrides)) {
        const segments = path.split(".")
        const leaf = segments.pop()
        if (!leaf) continue

        let node: JsonSchemaNode | undefined = jsonSchema
        for (const segment of segments) {
            node = node?.properties?.[segment]
        }

        const properties = node?.properties
        if (properties?.[leaf]) {
            const description = properties[leaf].description
            properties[leaf] = description ? { tsType, description } : { tsType }
        }
    }
}

function addTypeParams(declaration: string, typeName: string, typeParams: string): string {
    return declaration.replace(`interface ${typeName} `, `interface ${typeName}${typeParams} `).replace(`type ${typeName} =`, `type ${typeName}${typeParams} =`)
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
        return `{${entries.join(",")}}`
    }
    return JSON.stringify(value)
}

interface JsonSchemaNode {
    $schema?: string
    properties?: Record<string, JsonSchemaNode>
    required?: string[]
    description?: string
    tsType?: string
    [key: string]: unknown
}

export interface HoistedProjection {
    name: string
    schema: z.ZodType
}

export interface ProjectionOptions {
    typeName: string
    schema: z.ZodType
    io: "input" | "output"
    description?: string
    /** Top-level fields removed from the projection (e.g. auto-filled integrationId). */
    omitFields?: string[]
    /** Dot-path within the schema -> TypeScript type expression printed instead. */
    fieldOverrides?: Record<string, string>
    /** Printed verbatim after the type name, e.g. "<TBody = unknown>". */
    typeParams?: string
    /** Shared shapes replaced by a reference to their hoisted declaration. */
    hoisted?: HoistedProjection[]
}
