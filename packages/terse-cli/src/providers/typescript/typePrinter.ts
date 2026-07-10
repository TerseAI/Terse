import { type JSONSchema, compile } from "json-schema-to-typescript"
import { z } from "zod"

const COMPILE_OPTIONS = {
    bannerComment: "",
    additionalProperties: false,
    style: { tabWidth: 4, semi: false, printWidth: 120 }
} as const

export async function printType(options: PrintTypeOptions): Promise<string> {
    const jsonSchema = zodToJsonSchema(options.schema, options.io)
    omitFields(jsonSchema, options.omitFields ?? [])
    applyFieldOverrides(jsonSchema, options.fieldOverrides ?? {})
    replaceHoistedShapes(jsonSchema, buildHoistedTargets(options.hoisted ?? [], options.io))
    if (options.description) jsonSchema.description = options.description
    const compiled = await compile(jsonSchema, options.typeName, COMPILE_OPTIONS)
    if (/_?_[Ss]chema\d+/.test(compiled)) {
        throw new AnonymousSchemaError(options.typeName)
    }
    const declared = options.typeParams ? injectTypeParams(compiled, options.typeName, options.typeParams) : compiled
    return declared.trimEnd()
}

export class AnonymousSchemaError extends Error {
    constructor(typeName: string) {
        super(`Printed type ${typeName} contains an anonymous recursive sub-schema; give it a name in terse-types via .meta({ id: "..." })`)
        this.name = "AnonymousSchemaError"
    }
}

export async function printHoistedShape(shape: HoistedShape, io: PrintIo): Promise<string> {
    return printType({ typeName: shape.name, schema: shape.schema, io })
}

function zodToJsonSchema(schema: z.ZodType, io: PrintIo): JSONSchema {
    const result = z.toJSONSchema(schema, {
        io,
        unrepresentable: "any",
        reused: "inline",
        override: ctx => {
            if (ctx.zodSchema._zod.def.type === "date") {
                for (const key of Object.keys(ctx.jsonSchema)) delete ctx.jsonSchema[key]
                ctx.jsonSchema.tsType = "Date"
            }
        }
    })
    // Sole third-party boundary: zod emits draft 2020-12, json-schema-to-typescript accepts it but types against JSONSchema
    return result as JSONSchema
}

function injectTypeParams(source: string, typeName: string, typeParams: string): string {
    return source.replace(new RegExp(`(interface|type) ${typeName}\\b`), `$1 ${typeName}${typeParams}`)
}

function omitFields(schema: JSONSchema, fields: readonly string[]): void {
    if (fields.length === 0 || !schema.properties) return
    for (const field of fields) delete schema.properties[field]
    if (Array.isArray(schema.required)) {
        schema.required = schema.required.filter(name => !fields.includes(name))
    }
}

function applyFieldOverrides(schema: JSONSchema, overrides: Readonly<Record<string, string>>): void {
    for (const [path, tsType] of Object.entries(overrides)) {
        const segments = path.split(".")
        const parentSegments = segments.slice(0, -1)
        const leaf = segments[segments.length - 1]
        const parent = parentSegments.reduce<JSONSchema | undefined>((node, segment) => node?.properties?.[segment], schema)
        const target = parent?.properties?.[leaf]
        if (!parent?.properties || !target) continue
        parent.properties[leaf] = target.description ? { tsType, description: target.description } : { tsType }
    }
}

function buildHoistedTargets(hoisted: readonly HoistedShape[], io: PrintIo): HoistedTarget[] {
    return hoisted.map(shape => {
        const { $schema, ...jsonSchema } = zodToJsonSchema(shape.schema, io)
        return { name: shape.name, key: stableStringify(jsonSchema) }
    })
}

function replaceHoistedShapes(schema: JSONSchema, targets: readonly HoistedTarget[]): void {
    if (targets.length === 0) return
    walkSchema(schema, node => {
        const match = targets.find(target => stableStringify(node) === target.key)
        if (!match) return
        for (const key of Object.keys(node)) delete node[key]
        node.tsType = match.name
    })
}

function walkSchema(node: JSONSchema, visit: (node: JSONSchema) => void): void {
    visit(node)
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            value.forEach(item => {
                if (isSchemaNode(item)) walkSchema(item, visit)
            })
        } else if (isSchemaNode(value)) {
            walkSchema(value, visit)
        }
    }
}

function isSchemaNode(value: unknown): value is JSONSchema {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
        return `{${entries.join(",")}}`
    }
    return JSON.stringify(value) ?? "undefined"
}

export type PrintIo = "input" | "output"

export type HoistedShape = {
    readonly name: string
    readonly schema: z.ZodType
}

export type PrintTypeOptions = {
    readonly typeName: string
    readonly schema: z.ZodType
    readonly io: PrintIo
    readonly description?: string
    readonly omitFields?: readonly string[]
    readonly fieldOverrides?: Readonly<Record<string, string>>
    readonly hoisted?: readonly HoistedShape[]
    readonly typeParams?: string
}

type HoistedTarget = {
    readonly name: string
    readonly key: string
}
