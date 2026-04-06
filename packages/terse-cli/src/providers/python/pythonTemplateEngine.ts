import Handlebars from "handlebars"
import fs from "node:fs"
import path from "node:path"

import { getTemplatesRoot, readTemplateFile } from "../templateUtils.js"

import { type PythonTemplateContext, pyListRepr, pyRepr } from "./preparePythonCodegenData.js"

let template: Handlebars.TemplateDelegate<PythonTemplateContext> | undefined

function getHandlebars(): typeof Handlebars {
    const handlebars = Handlebars.create()

    handlebars.registerHelper("pyRepr", (value: unknown) => pyRepr(String(value ?? "")))
    handlebars.registerHelper("pyListRepr", (values: unknown) => (Array.isArray(values) ? pyListRepr(values.map(value => String(value))) : "[]"))
    handlebars.registerHelper("eq", (left: unknown, right: unknown) => left === right)

    const partialsDir = path.join(getTemplatesRoot(), "python", "codegen", "partials")
    for (const entry of fs.readdirSync(partialsDir).sort()) {
        if (!entry.endsWith(".hbs")) continue
        handlebars.registerPartial(path.basename(entry, ".hbs"), fs.readFileSync(path.join(partialsDir, entry), "utf-8"))
    }

    return handlebars
}

function getCompiledTemplate(): Handlebars.TemplateDelegate<PythonTemplateContext> {
    if (!template) {
        const handlebars = getHandlebars()
        template = handlebars.compile<PythonTemplateContext>(readTemplateFile("python/codegen/generated.hbs"), { noEscape: true })
    }
    return template
}

export function renderPythonGeneratedCode(context: PythonTemplateContext): string {
    return getCompiledTemplate()(context)
}
