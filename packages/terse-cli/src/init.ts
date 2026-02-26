import fs from "node:fs"
import path from "node:path"
import { exec, execSync } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import ora from "ora"
import chalk from "chalk"
import { input } from "@inquirer/prompts"
import { generate } from "./generate.js"

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FRONTEND_URL = "http://localhost:5173"
const BACKEND_URL = "http://localhost:3001"

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

    // Create src directory
    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true })

    const templatesDir = getTemplatesDir()
    const replacements = { PROJECT_NAME: resolvedName }

    // Write files from templates
    const files: Array<{ template: string; output: string }> = [
        { template: "package.json.tmpl", output: "package.json" },
        { template: "tsconfig.json.tmpl", output: "tsconfig.json" },
        { template: "src/index.ts.tmpl", output: "src/index.ts" },
        { template: "env.example.tmpl", output: ".env.example" },
        { template: "gitignore.tmpl", output: ".gitignore" },
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

    try {
        await execAsync(`${pm} install`, { cwd: targetDir })
        spinner.succeed(`Dependencies installed with ${pm}`)
    } catch {
        spinner.warn(`Failed to install dependencies. Run ${chalk.cyan(`${pm} install`)} manually.`)
    }

    // Prompt for API key and write .env
    await promptForApiKey(targetDir)

    const envExists = fs.existsSync(path.join(targetDir, ".env"))

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
        console.log(`  ${step}. Copy .env.example to .env and add your TERSE_API_KEY`)
        step++
    }
    console.log(`  ${step}. Edit src/index.ts to define your job`)
    step++
    console.log(`  ${step}. ${pm} run build    Build the project`)
    step++
    console.log(`  ${step}. ${pm} run dev      Run in development mode\n`)
}


async function promptForApiKey(targetDir: string): Promise<void> {
    console.log(`\n  Create an API key at: ${chalk.cyan(`${FRONTEND_URL}/app/profile?tab=api-tokens`)}\n`)

    try {
        const key = (await input({ message: "Paste your API key (or press Enter to skip):" })).trim()

        if (!key) {
            fs.writeFileSync(path.join(targetDir, ".env"), "TERSE_API_KEY=\n")
            console.log(chalk.dim("  Skipped — you can add TERSE_API_KEY to .env later."))
            return
        }

        // Validate the key against the backend
        const spinner = ora("Verifying API key").start()

        try {
            const res = await fetch(`${BACKEND_URL}/sdk/me`, {
                headers: { Authorization: `Bearer ${key}` },
            })

            if (res.ok) {
                const data = await res.json() as { firstName?: string | null; displayName?: string | null; email?: string | null }
                const name = data.firstName || data.displayName || data.email || "there"
                spinner.succeed(`Hello, ${name}! API key verified.`)
            } else {
                spinner.warn("Could not verify API key (invalid or server error). Saving it anyway.")
            }
        } catch {
            spinner.warn("Could not reach the server to verify your API key. Saving it anyway.")
        }

        fs.writeFileSync(path.join(targetDir, ".env"), `TERSE_API_KEY=${key}\n`)
    } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") {
            console.log("\n")
            process.exit(0)
        }
        throw error
    }
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
