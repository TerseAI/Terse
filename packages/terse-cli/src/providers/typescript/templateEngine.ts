import Handlebars from "handlebars"
import fs from "node:fs"
import path from "node:path"

import { getTemplatesRoot, readTemplateFile } from "../templateUtils.js"

import { type TemplateContext, escapeString } from "./prepareCodegenData.js"

let template: Handlebars.TemplateDelegate<TemplateContext> | undefined

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

function getCompiledTemplate(): Handlebars.TemplateDelegate<TemplateContext> {
    if (!template) {
        const handlebars = getHandlebars()
        template = handlebars.compile<TemplateContext>(readTemplateFile("typescript/codegen/generated.hbs"), { noEscape: true })
    }
    return template
}

export function renderGeneratedCode(context: TemplateContext): string {
    return getCompiledTemplate()(context)
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n$/, "")
}
