import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import * as z from "zod"

type ExportModule = Record<string, unknown>

/**
 * Name overrides for exports where the default derivation doesn't produce the desired name.
 * Default derivation: strip trailing "Schema", capitalize first letter, then apply
 * *Config -> *ConfigInstance and *Integration -> *IntegrationInstance patterns.
 */
const SCHEMA_NAME_OVERRIDES: Record<string, string> = {
    // Base types that need "Base" prefix
    ConfigInstanceSchema: "BaseConfigInstance",
    IntegrationInstanceSchema: "BaseIntegrationInstance",
    // Name differs from export key
    slackUserResponseSchema: "SlackUserSummary",
    runHistoryActionBaseSchema: "RunHistoryAction",
    // GitHub capitalization fix
    GithubIntegrationSchema: "GitHubIntegrationInstance"
}

function isZodSchema(value: unknown): value is z.ZodTypeAny {
    return !!value && typeof value === "object" && "_zod" in value
}

function isToolDefinition(value: unknown): value is { name: string; inputSchema: z.ZodTypeAny; outputSchema: z.ZodTypeAny } {
    if (!value || typeof value === "function" || typeof value !== "object") return false
    const obj = value as Record<string, unknown>
    return typeof obj.name === "string" && isZodSchema(obj.inputSchema) && isZodSchema(obj.outputSchema)
}

function deriveSchemaName(exportKey: string): string {
    if (SCHEMA_NAME_OVERRIDES[exportKey]) {
        return SCHEMA_NAME_OVERRIDES[exportKey]
    }

    let name = exportKey.replace(/Schema$/, "")
    name = name.charAt(0).toUpperCase() + name.slice(1)

    // Pattern: *Config -> *ConfigInstance (e.g., GmailConfig -> GmailConfigInstance)
    if (/[a-z]Config$/.test(name)) {
        name += "Instance"
    }

    // Pattern: *Integration -> *IntegrationInstance (but not IntegrationWithStatus)
    if (/[a-z]Integration$/.test(name) && !name.includes("With")) {
        name += "Instance"
    }

    return name
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function rewriteRecursiveRefs(schemaName: string, value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => rewriteRecursiveRefs(schemaName, item))
    }
    if (!value || typeof value !== "object") {
        return value
    }
    return Object.fromEntries(
        Object.entries(value).map(([key, v]) => {
            if (key === "$ref" && v === "#") {
                return [key, `#/$defs/${schemaName}`]
            }
            return [key, rewriteRecursiveRefs(schemaName, v)]
        })
    )
}

async function main() {
    const moduleExports = (await import(new URL("../dist/index.js", import.meta.url).href)) as ExportModule

    // Phase 1: Discover all schemas and build identity registry
    const schemaRegistry = new Map<z.ZodTypeAny, string>()
    const schemasToExport = new Map<string, z.ZodTypeAny>()
    let toolCount = 0
    let standaloneCount = 0

    for (const [key, value] of Object.entries(moduleExports)) {
        console.log(`Processing export key: ${key}`)
        if (isToolDefinition(value)) {
            const baseName = capitalize(key.replace(/Tool$/, ""))
            const inputName = `${baseName}ToolInput`
            const outputName = `${baseName}ToolOutput`
            schemasToExport.set(inputName, value.inputSchema)
            schemasToExport.set(outputName, value.outputSchema)
            schemaRegistry.set(value.inputSchema, inputName)
            schemaRegistry.set(value.outputSchema, outputName)
            toolCount++
        } else if (isZodSchema(value)) {
            const name = deriveSchemaName(key)
            schemasToExport.set(name, value)
            schemaRegistry.set(value, name)
            standaloneCount++
        }
    }

    // Phase 2: Convert to JSON Schema with $ref resolution for named sub-schemas
    const defs: Record<string, unknown> = {}
    const converting = new Set<string>()

    function convertSchema(name: string, schema: z.ZodTypeAny): unknown {
        if (converting.has(name)) {
            return { $ref: `#/$defs/${name}` }
        }
        converting.add(name)

        const jsonSchema = z.toJSONSchema(schema, {
            target: "draft-2020-12",
            unrepresentable: "any",
            cycles: "ref",
            override: ({ zodSchema, jsonSchema: js }) => {
                // Handle date types -> ISO string
                const defType = (zodSchema as { _zod?: { def?: { type?: string } } })._zod?.def?.type
                if (defType === "date" && js && typeof js === "object") {
                    Object.assign(js, { type: "string", format: "date-time" })
                    return
                }

                // Emit $ref for known sub-schemas instead of inlining
                const registeredName = schemaRegistry.get(zodSchema)
                if (registeredName && registeredName !== name && js && typeof js === "object") {
                    if (!defs[registeredName]) {
                        defs[registeredName] = convertSchema(registeredName, zodSchema)
                    }
                    // Mutate jsonSchema in-place (Zod ignores return values from override)
                    for (const key of Object.keys(js)) {
                        delete (js as Record<string, unknown>)[key]
                    }
                    ;(js as Record<string, unknown>).$ref = `#/$defs/${registeredName}`
                }
            }
        })

        converting.delete(name)

        // Strip $schema from individual entries
        if (jsonSchema && typeof jsonSchema === "object" && "$schema" in jsonSchema) {
            delete (jsonSchema as { $schema?: string }).$schema
        }

        return rewriteRecursiveRefs(name, jsonSchema)
    }

    for (const [name, schema] of schemasToExport) {
        if (!defs[name]) {
            defs[name] = convertSchema(name, schema)
        }
    }

    // Phase 2b: Add titles to inline objects in oneOf/anyOf unions so that
    // datamodel-codegen --use-title-as-name produces semantic class names
    // (e.g. ModelEventToolApprovalResponse instead of ModelEvent1).
    function toPascalCase(s: string): string {
        return s.replace(/(^|_)(.)/g, (_, __, c: string) => c.toUpperCase())
    }

    for (const [defName, defSchema] of Object.entries(defs)) {
        if (!defSchema || typeof defSchema !== "object") continue
        const schema = defSchema as Record<string, unknown>
        for (const unionKey of ["oneOf", "anyOf"] as const) {
            const members = schema[unionKey]
            if (!Array.isArray(members)) continue
            for (const member of members) {
                if (!member || typeof member !== "object") continue
                const m = member as Record<string, unknown>
                if (m.type !== "object" || !m.properties || typeof m.properties !== "object") continue
                const props = m.properties as Record<string, Record<string, unknown>>
                for (const propSchema of Object.values(props)) {
                    if ("const" in propSchema) {
                        m.title = `${defName}${toPascalCase(String(propSchema.const))}`
                        break
                    }
                }
            }
        }
    }

    // Phase 2c: Title inline property schemas so datamodel-codegen uses
    // "{Parent}{Property}" names instead of "Limit1", "Page2", etc.
    for (const [defName, defSchema] of Object.entries(defs)) {
        if (!defSchema || typeof defSchema !== "object") continue
        const schema = defSchema as Record<string, unknown>
        if (schema.type !== "object" || !schema.properties || typeof schema.properties !== "object") continue
        const props = schema.properties as Record<string, Record<string, unknown>>
        for (const [propName, propSchema] of Object.entries(props)) {
            if (!propSchema || typeof propSchema !== "object" || propSchema.$ref || propSchema.title) continue
            // Only title non-trivial inline schemas (have constraints, defaults, anyOf, oneOf, or nested objects)
            const isNonTrivial =
                "minimum" in propSchema ||
                "maximum" in propSchema ||
                "default" in propSchema ||
                "anyOf" in propSchema ||
                "oneOf" in propSchema ||
                "allOf" in propSchema ||
                (propSchema.type === "object" && "properties" in propSchema)
            if (isNonTrivial) {
                propSchema.title = `${defName}${toPascalCase(propName)}`
            }
        }
    }

    // Phase 2d: Strip JS Number.MAX_SAFE_INTEGER / MIN_SAFE_INTEGER bounds —
    // they carry no Python semantics and produce noisy constraints.
    const JS_SAFE_MAX = 9007199254740991
    const JS_SAFE_MIN = -9007199254740991
    function stripJsSafeBounds(obj: unknown): void {
        if (Array.isArray(obj)) {
            for (const item of obj) stripJsSafeBounds(item)
            return
        }
        if (!obj || typeof obj !== "object") return
        const rec = obj as Record<string, unknown>
        if (rec.maximum === JS_SAFE_MAX) delete rec.maximum
        if (rec.minimum === JS_SAFE_MIN) delete rec.minimum
        if (rec.exclusiveMaximum === JS_SAFE_MAX) delete rec.exclusiveMaximum
        if (rec.exclusiveMinimum === JS_SAFE_MIN) delete rec.exclusiveMinimum
        for (const v of Object.values(rec)) stripJsSafeBounds(v)
    }
    stripJsSafeBounds(defs)

    // Phase 3: Write output
    const outputPath = fileURLToPath(new URL("../dist/json-schema/terse-types.schema.json", import.meta.url))
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(
        outputPath,
        `${JSON.stringify(
            {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                $defs: defs
            },
            null,
            2
        )}\n`
    )

    console.log(`Wrote ${Object.keys(defs).length} schemas to ${outputPath}`)
    console.log(`  tools=${toolCount} (${toolCount * 2} input+output schemas), standalone=${standaloneCount}`)
}

void main().catch(error => {
    console.error("[export-json-schema] Failed to export JSON Schema.")
    console.error(error)
    process.exitCode = 1
})
