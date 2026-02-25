import Handlebars from "handlebars"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

async function resolveTemplatePath(pathToTemplate: string): Promise<string> {
    const candidates = [
        path.join(moduleDir, "templates", pathToTemplate),
        path.resolve(process.cwd(), "src/notifications/emails/templates", pathToTemplate),
        path.resolve(process.cwd(), "dist/notifications/emails/templates", pathToTemplate),
        path.resolve(process.cwd(), "dist/src/notifications/emails/templates", pathToTemplate)
    ]

    for (const candidate of candidates) {
        try {
            await fs.access(candidate)
            return candidate
        } catch {
            // Try next candidate path.
        }
    }

    throw new Error(`Template not found: ${pathToTemplate}`)
}

export async function loadTemplate(pathToTemplate: string, data: any): Promise<string> {
    const templatePath = await resolveTemplatePath(pathToTemplate)

    try {
        const templateContent = await fs.readFile(templatePath, "utf-8")
        const template = Handlebars.compile(templateContent)
        return template(data)
    } catch (error) {
        console.error(`Error loading template at ${templatePath}:`, error)
        throw new Error(`Failed to load email template: ${error instanceof Error ? error.message : String(error)}`)
    }
}
