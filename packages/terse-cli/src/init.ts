import fs from "node:fs"
import path from "node:path"
import { exec, execSync } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import ora from "ora"
import chalk from "chalk"
import { confirm } from "@inquirer/prompts"
import { readApiKey } from "./api.js"
import { loginAndWriteEnv } from "./auth.js"
import { generate } from "./generate.js"
import { listAndPromptIntegrations } from "./integrate.js"
import { integrate } from "./integrate.js"
import { fetchIntegrations } from "./integrationApi.js"
import { INTEGRATION_METADATA, IntegrationType } from "./shared/Integrations.js"

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function init(projectName?: string): Promise<void> {
    const targetDir = projectName ? path.resolve(process.cwd(), projectName) : process.cwd()
    const resolvedName = projectName ?? path.basename(process.cwd())

    console.log(`\n  Creating Terse project ${chalk.bold(resolvedName)}\n`)

    // Create target directory if it doesn't exist
    if (projectName) {
        if (fs.existsSync(targetDir)) {
            console.error(chalk.red(`Error: Directory "${projectName}" already exists.`))
            process.exit(1)
        }
        fs.mkdirSync(targetDir, { recursive: true })
    }

    // Create src and .claude directories
    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true })
    fs.mkdirSync(path.join(targetDir, ".claude"), { recursive: true })

    const templatesDir = getTemplatesDir()
    const replacements = { PROJECT_NAME: resolvedName }

    // Write files from templates
    const files: Array<{ template: string; output: string }> = [
        { template: "package.json.tmpl", output: "package.json" },
        { template: "tsconfig.json.tmpl", output: "tsconfig.json" },
        { template: "src/index.ts.tmpl", output: "src/index.ts" },
        { template: "env.example.tmpl", output: ".env.example" },
        { template: "gitignore.tmpl", output: ".gitignore" },
        { template: ".claude/settings.json.tmpl", output: ".claude/settings.json" },
    ]

    for (const file of files) {
        const content = readTemplate(templatesDir, file.template)
        const rendered = applyReplacements(content, replacements)
        const outputPath = path.join(targetDir, file.output)
        fs.writeFileSync(outputPath, rendered)
        console.log(`  ${chalk.green("+")} ${file.output}`)
    }

    // Install dependencies
    const pm = detectPackageManager()
    const spinner = ora(`Installing dependencies with ${pm}`).start()

    // Rest of commands run in newly generated project directory
    await changeDirectory(targetDir)

    try {
        await execAsync(`${pm} install`)
        spinner.succeed(`Dependencies installed with ${pm}`)
    } catch {
        spinner.warn(`Failed to install dependencies. Run ${chalk.cyan(`${pm} install`)} manually.`)
    }

    // Authenticate via browser and write API key to .env
    await loginAndWriteEnv(targetDir)

    const envExists = fs.existsSync(path.join(targetDir, ".env"))

    // Connect integrations
    await listAndPromptIntegrations()

    try {
        await generate()
        spinner.succeed(`Generated code`)
    } catch {
        spinner.warn(`Failed to generate code. Run ${chalk.cyan(`$terse generate`)} manually.`)
    }

    console.log(`\n  ${chalk.green.bold("Done!")} Your Terse project is ready.\n`)
    console.log("  Next steps:\n")

    let step = 1
    if (projectName) {
        console.log(`  ${step}. cd ${projectName}`)
        step++
    }
    if (!envExists) {
        console.log(`  ${step}. Run ${chalk.cyan("terse login")} to authenticate`)
        step++
    }
    console.log(`  ${step}. Edit src/index.ts to define your job`)
    step++
    console.log(`  ${step}. ${pm} run build    Build the project`)
    step++
    console.log(`  ${step}. ${pm} run dev      Run in development mode\n`)
}



function getTemplatesDir(): string {
    // In dist/, templates are at ../templates relative to the compiled file
    const fromDist = path.resolve(__dirname, "..", "templates")
    if (fs.existsSync(fromDist)) return fromDist

    // Fallback for development
    const fromSrc = path.resolve(__dirname, "..", "..", "templates")
    if (fs.existsSync(fromSrc)) return fromSrc

    throw new Error("Could not find templates directory")
}

function readTemplate(templatesDir: string, templatePath: string): string {
    return fs.readFileSync(path.join(templatesDir, templatePath), "utf-8")
}

function applyReplacements(content: string, replacements: Record<string, string>): string {
    let result = content
    for (const [token, value] of Object.entries(replacements)) {
        result = result.replaceAll(`{{${token}}}`, value)
    }
    return result
}

function detectPackageManager(): "pnpm" | "npm" {
    try {
        execSync("pnpm --version", { stdio: "ignore" })
        return "pnpm"
    } catch {
        return "npm"
    }
}

function changeDirectory(targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            process.chdir(targetDir)
            resolve()
        } catch (err) {
            reject(err)
        }
    })
}
