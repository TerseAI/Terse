import Handlebars from "handlebars"
import fs from "node:fs"
import path from "node:path"

import type { GeneratedFile } from "../LanguageProvider.js"
import { getTemplatesRoot, readTemplateFile } from "../templateUtils.js"

import { type TemplateContext, escapeString } from "./prepareCodegenData.js"

export function renderGeneratedFiles(context: TemplateContext): GeneratedFile[] {
    const code = getCompiledTemplate()(context)
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n$/, "")
    return [{ fileName: "terse.generated.ts", code }]
}

function getHandlebars(): typeof Handlebars {
    const handlebars = Handlebars.create()

    handlebars.registerHelper("sectionHeader", (name: string) => {
        const dashes = "─".repeat(Math.max(1, 58 - name.length))
        return `// ── ${name} ${dashes}`
    })
    handlebars.registerHelper("escape", (value: unknown) => escapeString(String(value ?? "")))
    handlebars.registerHelper("eq", (left: unknown, right: unknown) => left === right)
    handlebars.registerHelper("joinPipe", (values: unknown) => (Array.isArray(values) ? values.join(" | ") : ""))

    const partialsDir = path.join(getTemplatesRoot(), "typescript", "codegen", "partials")
    for (const entry of fs.readdirSync(partialsDir).sort()) {
        if (!entry.endsWith(".hbs")) continue
        const partialName = path.basename(entry, ".hbs")
        handlebars.registerPartial(partialName, fs.readFileSync(path.join(partialsDir, entry), "utf-8"))
    }

    return handlebars
}

let template: Handlebars.TemplateDelegate<TemplateContext> | undefined

function getCompiledTemplate(): Handlebars.TemplateDelegate<TemplateContext> {
    if (!template) {
        template = getHandlebars().compile<TemplateContext>(readTemplateFile("typescript/codegen/generated.hbs"), { noEscape: true })
    }
    return template
}
