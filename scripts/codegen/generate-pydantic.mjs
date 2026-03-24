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
            "npx ts-json-schema-generator",
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

function generatePydanticModels() {
    run(
        [
            "datamodel-codegen",
            `--input "${SCHEMA_OUT}"`,
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
    const discriminatedUnions = ["SdkAgentStreamEvent", "ModelEvent"]
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
generatePydanticModels()
postProcess()
writeGeneratedInit()

console.log(`
=== Done ===

Verify with:
  python -c "from terse_sdk.generated.models import *"
  python -c "from terse_sdk.generated.models import IntegrationType, RunHistoryStatus, SdkAgentRunRequestBody; print(IntegrationType.SLACK)"
`)
