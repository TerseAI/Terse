#!/usr/bin/env node
/**
 * generate-pydantic.mjs
 *
 * End-to-end script: shared/*.ts  →  JSON Schema  →  Pydantic v2 models
 *
 * Usage:
 *   node scripts/codegen/generate-pydantic.mjs
 *   npm run generate:pydantic
 *
 * Prerequisites:
 *   - ts-json-schema-generator  (installed as a devDependency, runs via npx)
 *   - datamodel-code-generator  (pip install datamodel-code-generator)
 */

import { execSync, spawnSync } from "child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "../..")
const CODEGEN_DIR = __dirname
const OUTPUT_DIR = resolve(ROOT, "packages/terse-python-sdk/terse_sdk/generated")
const SCHEMA_OUT = resolve(OUTPUT_DIR, "_schema.json")
const MODELS_OUT = resolve(OUTPUT_DIR, "models.py")

// ─── helpers ────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
    console.log(`\n▶ ${cmd}`)
    execSync(cmd, { stdio: "inherit", cwd: CODEGEN_DIR, ...opts })
}

function checkPrerequisites() {
    const result = spawnSync("datamodel-codegen", ["--version"], { encoding: "utf8" })
    if (result.error || result.status !== 0) {
        console.error(`
ERROR: datamodel-codegen is not installed or not on PATH.

Install it with one of:
  pip install datamodel-code-generator
  pipx install datamodel-code-generator

Then re-run:
  npm run generate:pydantic
`)
        process.exit(1)
    }
    console.log(`✓ datamodel-codegen ${result.stdout.trim()}`)
}

function ensureOutputDir() {
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true })
        console.log(`✓ Created ${OUTPUT_DIR}`)
    }
}

function generateJsonSchema() {
    run(
        [
            "npx --no-install ts-json-schema-generator",
            `--tsconfig tsconfig.codegen.json`,
            `--path codegen-entry.ts`,
            `--type "*"`,
            `--expose all`,
            `--jsDoc extended`,
            `--out "${SCHEMA_OUT}"`,
        ].join(" "),
        { cwd: CODEGEN_DIR }
    )
    console.log(`✓ JSON Schema written to ${SCHEMA_OUT}`)
}

function getDefinitionsRoot(schema) {
    if (schema && typeof schema === "object") {
        if (schema.$defs && typeof schema.$defs === "object") {
            return { defs: schema.$defs, refPrefix: "#/$defs/" }
        }
        if (schema.definitions && typeof schema.definitions === "object") {
            return { defs: schema.definitions, refPrefix: "#/definitions/" }
        }
    }
    return null
}

function resolveDefinitionRef(ref, defs, refPrefix) {
    if (typeof ref !== "string" || !ref.startsWith(refPrefix)) {
        return null
    }

    const definitionName = decodeURIComponent(ref.slice(refPrefix.length))
    const schema = defs[definitionName]
    if (!schema || typeof schema !== "object") {
        return null
    }

    return { definitionName, schema }
}

function getDiscriminatorLiteralValue(schemaNode, defs, refPrefix) {
    const resolvedSchema = schemaNode?.$ref ? resolveDefinitionRef(schemaNode.$ref, defs, refPrefix)?.schema : schemaNode
    const typeProperty = resolvedSchema?.properties?.type

    if (typeof typeProperty?.const === "string") {
        return typeProperty.const
    }

    if (Array.isArray(typeProperty?.enum) && typeProperty.enum.length === 1 && typeof typeProperty.enum[0] === "string") {
        return typeProperty.enum[0]
    }

    return null
}

function toPascalCase(value) {
    const normalized = String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()

    const parts = normalized ? normalized.split(/\s+/) : []
    const pascalCase = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("")

    if (!pascalCase) {
        return "Variant"
    }

    return /^[0-9]/.test(pascalCase) ? `Variant${pascalCase}` : pascalCase
}

function getUniqueDefinitionName(baseName, defs) {
    if (!(baseName in defs)) {
        return baseName
    }

    let index = 2
    while (`${baseName}${index}` in defs) {
        index += 1
    }
    return `${baseName}${index}`
}

function normalizeTaggedUnions() {
    const schema = JSON.parse(readFileSync(SCHEMA_OUT, "utf8"))
    const root = getDefinitionsRoot(schema)

    if (!root) {
        console.warn(`⚠  WARNING: Could not find schema definitions in ${SCHEMA_OUT}; skipping tagged-union normalization.`)
        return
    }

    const { defs, refPrefix } = root
    const transformedUnions = []

    for (const [unionName, definition] of Object.entries(defs)) {
        if (!definition || typeof definition !== "object" || definition.discriminator) {
            continue
        }

        const unionKey = Array.isArray(definition.anyOf) ? "anyOf" : Array.isArray(definition.oneOf) ? "oneOf" : null
        if (!unionKey) {
            continue
        }

        const variants = []
        const seenTags = new Set()
        let isTaggedUnion = true

        for (const variant of definition[unionKey]) {
            const tag = getDiscriminatorLiteralValue(variant, defs, refPrefix)
            if (!tag || seenTags.has(tag)) {
                isTaggedUnion = false
                break
            }

            seenTags.add(tag)
            variants.push({ tag, variant })
        }

        if (!isTaggedUnion || variants.length < 2) {
            continue
        }

        const mapping = {}

        definition[unionKey] = variants.map(({ tag, variant }) => {
            if (variant.$ref) {
                mapping[tag] = variant.$ref
                return variant
            }

            const definitionName = getUniqueDefinitionName(`${unionName}${toPascalCase(tag)}`, defs)
            const ref = `${refPrefix}${encodeURIComponent(definitionName)}`

            defs[definitionName] = variant
            mapping[tag] = ref

            return { $ref: ref }
        })

        definition.discriminator = {
            propertyName: "type",
            mapping,
        }

        transformedUnions.push(unionName)
    }

    if (transformedUnions.length > 0) {
        writeFileSync(SCHEMA_OUT, `${JSON.stringify(schema, null, 2)}\n`, "utf8")
        console.log(`✓ Normalized tagged unions: ${transformedUnions.join(", ")}`)
    }
}

function generatePydanticModels() {
    run(
        [
            "datamodel-codegen",
            `--input "${SCHEMA_OUT}"`,
            `--input-file-type jsonschema`,
            `--output "${MODELS_OUT}"`,
            `--output-model-type pydantic_v2.BaseModel`,
            `--use-annotated`,
            `--target-python-version 3.11`,
            `--use-union-operator`,
            `--enum-field-as-literal all`,
            `--use-default`,
            `--field-constraints`,
        ].join(" "),
        { cwd: CODEGEN_DIR }
    )
    console.log(`✓ Pydantic models written to ${MODELS_OUT}`)
}

function postProcess() {
    let src = readFileSync(MODELS_OUT, "utf8")

    // 1. Prepend auto-generated header
    const header = `# This file is AUTO-GENERATED. Do not edit manually.
# Source of truth: shared/*.ts
# Regenerate with: npm run generate:pydantic
#
# Generated on: ${new Date().toISOString()}
`
    if (!src.startsWith("# This file is AUTO-GENERATED")) {
        src = header + "\n" + src
    }

    // 2. Ensure datetime import is present if needed
    if (src.includes("datetime") && !src.includes("from datetime import")) {
        src = src.replace(
            /^(from __future__.*\n)?/m,
            (m) => m + "from datetime import datetime\n"
        )
    }

    // 3. Warn if discriminated unions are missing Field(discriminator=...)
    const discriminatedUnions = ["ChatSnippet", "SdkAgentStreamEvent", "ModelEvent"]
    for (const name of discriminatedUnions) {
        if (src.includes(`class ${name}`) && !src.includes("discriminator=")) {
            console.warn(
                `⚠  WARNING: ${name} may be missing Field(discriminator="type"). ` +
                    `Check ${MODELS_OUT} and add it manually if needed.`
            )
        }
    }

    writeFileSync(MODELS_OUT, src, "utf8")
    console.log(`✓ Post-processing complete`)
}

function writeGeneratedInit() {
    const initPath = resolve(OUTPUT_DIR, "__init__.py")
    if (!existsSync(initPath)) {
        writeFileSync(
            initPath,
            `# This package is AUTO-GENERATED. Do not edit manually.
from .models import *  # noqa: F401, F403
`,
            "utf8"
        )
        console.log(`✓ Created ${initPath}`)
    }
}

// ─── main ────────────────────────────────────────────────────────────────────

console.log("=== Terse Python SDK — Pydantic codegen ===\n")

checkPrerequisites()
ensureOutputDir()
generateJsonSchema()
normalizeTaggedUnions()
generatePydanticModels()
postProcess()
writeGeneratedInit()

console.log(`
=== Done ===

Verify with:
  python -c "from terse_sdk.generated.models import *"
  python -c "from terse_sdk.generated.models import IntegrationType, RunHistoryStatus, SdkAgentRunRequestBody; print(IntegrationType.SLACK)"
`)
