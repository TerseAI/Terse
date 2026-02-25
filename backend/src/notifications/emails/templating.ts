import fs from "fs/promises"
import Handlebars from "handlebars"
import path from "path"
import { fileURLToPath } from "url"

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const templatesDir = path.resolve(moduleDir, "templates")

export async function loadTemplate(pathToTemplate: string, data: any): Promise<string> {
    const templatePath = path.resolve(templatesDir, pathToTemplate)

    try {
        const templateContent = await fs.readFile(templatePath, "utf-8")
        const template = Handlebars.compile(templateContent)
        return template(data)
    } catch (error) {
        console.error(`Error loading template at ${templatePath}:`, error)
        throw new Error(`Failed to load email template: ${error instanceof Error ? error.message : String(error)}`)
    }
}
