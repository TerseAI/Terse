import fs from "fs/promises"
import Handlebars from "handlebars"
import path from "path"
import { fileURLToPath } from "url"

import logger from "../../common/logger"
import { extractErrorMessage } from "../../common/strings"

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const templatesDir = path.resolve(moduleDir, "templates")

export async function loadTemplate(pathToTemplate: string, data: any): Promise<string> {
    const templatePath = path.resolve(templatesDir, pathToTemplate)

    try {
        const templateContent = await fs.readFile(templatePath, "utf-8")
        const template = Handlebars.compile(templateContent)
        return template(data)
    } catch (error) {
        logger.error("Error loading email template", { templatePath, error })
        throw new Error(`Failed to load email template: ${extractErrorMessage(error)}`)
    }
}
