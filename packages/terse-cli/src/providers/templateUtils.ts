import Handlebars from "handlebars"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getCliPackageRoot(): string {
    return path.resolve(__dirname, "..", "..")
}

export function getTemplatesRoot(): string {
    const templatesRoot = path.join(getCliPackageRoot(), "templates")
    if (!fs.existsSync(templatesRoot)) {
        throw new Error("Could not find templates directory")
    }
    return templatesRoot
}

export function readTemplateFile(relativePath: string): string {
    return fs.readFileSync(path.join(getTemplatesRoot(), relativePath), "utf-8")
}

export function renderTemplate(relativePath: string, context: Record<string, unknown>, handlebars: typeof Handlebars = Handlebars): string {
    const source = readTemplateFile(relativePath)
    return handlebars.compile(source, { noEscape: true })(context)
}

function readTemplateDir(relativePath: string): string[] {
    const dir = path.join(getTemplatesRoot(), relativePath)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).sort()
}
