import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FRONTEND_URL = "http://localhost:5173"

export async function init(projectName?: string): Promise<void> {
    const targetDir = projectName ? path.resolve(process.cwd(), projectName) : process.cwd()
    const resolvedName = projectName ?? path.basename(process.cwd())

    console.log(`\nCreating Terse project "${resolvedName}"...\n`)

    // Create target directory if it doesn't exist
    if (projectName) {
        if (fs.existsSync(targetDir)) {
            console.error(`Error: Directory "${projectName}" already exists.`)
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
        console.log(`  Created ${file.output}`)
    }

    // Install dependencies
    const pm = detectPackageManager()
    console.log(`\nInstalling dependencies with ${pm}...\n`)

    try {
        execSync(`${pm} install`, { cwd: targetDir, stdio: "inherit" })
    } catch {
        console.warn(`\nWarning: Failed to install dependencies. Run "${pm} install" manually.`)
    }

    // Prompt for API key and write .env
    await promptForApiKey(targetDir)

    const envExists = fs.existsSync(path.join(targetDir, ".env"))

    console.log(`
Done! Your Terse project is ready.

Next steps:
  ${projectName ? `cd ${projectName}` : ""}
  ${envExists ? "1. Edit src/index.ts to define your job" : "1. Copy .env.example to .env and add your TERSE_API_KEY\n  2. Edit src/index.ts to define your job"}
  ${envExists ? "2" : "3"}. ${pm} run build    Build the project
  ${envExists ? "3" : "4"}. ${pm} run dev      Run in development mode
`)
}


async function promptForApiKey(targetDir: string): Promise<void> {
    console.log(`\nYou can create an API key at: ${FRONTEND_URL}/app/profile?tab=api-tokens`)

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
        const key = (await rl.question("Paste your API key (or press Enter to skip): ")).trim()

        if (!key) {
            console.log("  Skipped — you can add TERSE_API_KEY to .env later.")
            fs.writeFileSync(path.join(targetDir, ".env"), "TERSE_API_KEY=\n")
            return
        }

        // Validate the key against the backend
        try {
            const res = await fetch(`${FRONTEND_URL}/sdk/me`, {
                headers: { Authorization: `Bearer ${key}` },
            })

            if (res.ok) {
                const data = await res.json() as { firstName?: string | null; displayName?: string | null; email?: string | null }
                const name = data.firstName || data.displayName || data.email || "there"
                console.log(`\n  Hello, ${name}! API key verified.\n`)
            } else {
                console.warn("\n  Warning: Could not verify API key (invalid or server error). Saving it anyway.\n")
            }
        } catch {
            console.warn("\n  Warning: Could not reach the server to verify your API key. Saving it anyway.\n")
        }

        fs.writeFileSync(path.join(targetDir, ".env"), `TERSE_API_KEY=${key}\n`)
    } finally {
        rl.close()
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