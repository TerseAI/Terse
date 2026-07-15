import Handlebars from "handlebars"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getTemplatesRoot, readTemplateFile } from "../../templateUtils.js"

import { escapeString } from "./moduleHelpers.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Renders codegen handlebars templates: the shared ones under templates/typescript/codegen/
 * and the per-integration ones co-located with each module under this directory.
 */
export class ModuleTemplateRenderer {
    private static instance: ModuleTemplateRenderer | undefined

    private readonly handlebars: typeof Handlebars
    private readonly templateCache = new Map<string, Handlebars.TemplateDelegate<object>>()

    private constructor() {
        this.handlebars = Handlebars.create()

        this.handlebars.registerHelper("sectionHeader", (name: string) => {
            const dashes = "─".repeat(Math.max(1, 58 - name.length))
            return `// ── ${name} ${dashes}`
        })
        this.handlebars.registerHelper("escape", (value: unknown) => escapeString(String(value ?? "")))
        this.handlebars.registerHelper("eq", (left: unknown, right: unknown) => left === right)
        this.handlebars.registerHelper("joinPipe", (values: unknown) => (Array.isArray(values) ? values.join(" | ") : ""))

        const partialsDir = path.join(getTemplatesRoot(), "typescript", "codegen", "partials")
        for (const entry of fs.readdirSync(partialsDir).sort()) {
            if (!entry.endsWith(".hbs")) continue
            const partialName = path.basename(entry, ".hbs")
            this.handlebars.registerPartial(partialName, fs.readFileSync(path.join(partialsDir, entry), "utf-8"))
        }
    }

    static getInstance(): ModuleTemplateRenderer {
        if (!ModuleTemplateRenderer.instance) {
            ModuleTemplateRenderer.instance = new ModuleTemplateRenderer()
        }
        return ModuleTemplateRenderer.instance
    }

    renderModuleTemplate(moduleDir: string, templateFile: string, context: object): string {
        return this.compile(path.join(getModulesRoot(), moduleDir, templateFile))(context)
    }

    renderCodegenTemplate(relativePath: string, context: object): string {
        return this.compile(path.join(getTemplatesRoot(), "typescript", "codegen", relativePath))(context)
    }

    readCodegenTemplate(relativePath: string): string {
        return readTemplateFile(path.join("typescript", "codegen", relativePath))
    }

    private compile(templatePath: string): Handlebars.TemplateDelegate<object> {
        let template = this.templateCache.get(templatePath)
        if (!template) {
            template = this.handlebars.compile<object>(fs.readFileSync(templatePath, "utf-8"), { noEscape: true })
            this.templateCache.set(templatePath, template)
        }
        return template
    }
}

// Module templates ship inside the npm package as src/**/*.hbs (see the package.json files
// globs); resolution therefore always goes through the source tree, even when running from dist.
export function getModulesRoot(): string {
    const packageRoot = path.resolve(__dirname, "..", "..", "..", "..")
    return path.join(packageRoot, "src", "providers", "typescript", "modules")
}
