import { confirm, intro, isCancel, log, outro } from "@clack/prompts"
import chalk from "chalk"
import { execFile as execFileCallback, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { z } from "zod"

import { CliError } from "../cliError.js"
import { NonInteractiveOpts, isNonInteractive } from "../cliHelpers.js"
import { getStoredApiKey } from "../userConfig.js"

import { loginAndPersist } from "./auth.js"

const execFile = promisify(execFileCallback)

const REPO_SLUG = "TerseAI/Terse"
const MARKETPLACE_URL = `https://raw.githubusercontent.com/${REPO_SLUG}/main/.claude-plugin/marketplace.json`
const CLAUDE_PERMISSION_RULE = "Bash(terse:*)"

export async function install(opts?: NonInteractiveOpts): Promise<void> {
    intro("terse install")
    await ensureGlobalCli(opts)
    const bundle = await fetchSkillBundle()
    await installSkillBundle(bundle)
    await offerClaudePermissions(opts)
    await ensureAuth(opts)

    const installationMessage = [
        chalk.green("Terse installation is complete."),
        "",
        chalk.bold("To create your first workflow:"),
        "",
        "1. Open your coding agent (claude, cursor, codex etc.)",
        `2. Run this slash command: ${chalk.green("/terse-create <describe your workflow>")}`,
        "",
        chalk.bold("OR"),
        "",
        `Create a project from the CLI: ${chalk.green("terse init <projectName>")}`
    ].join("\n")
    outro(installationMessage)
}

export async function update(): Promise<void> {
    intro("terse update")
    await updateGlobalCli()
    const bundle = await fetchSkillBundle()
    await updateSkillBundle(bundle)
    outro("Terse CLI and skills are up to date.")
}

async function ensureGlobalCli(opts?: NonInteractiveOpts): Promise<void> {
    if (await isOnPath("terse")) return
    if (!isNonInteractive(opts)) {
        const shouldInstall = await confirm({
            message: "Install the Terse CLI globally so `terse` works in every shell? (npm install -g terse-cli)"
        })
        if (isCancel(shouldInstall) || !shouldInstall) {
            log.info("Skipping global install — you can keep using `npx terse-cli`.")
            return
        }
    }
    await runStreaming("npm", ["install", "-g", "terse-cli"])
}

async function updateGlobalCli(): Promise<void> {
    if (!(await isOnPath("terse"))) {
        log.info("Terse CLI is not installed globally — skipping self-update. Run `terse install` to set it up.")
        return
    }
    log.step("Updating the Terse CLI")
    await runStreaming("npm", ["install", "-g", "terse-cli@latest"])
}

// The official skill set is whatever the plugin marketplace manifest on main
// declares — the CLI ships no copy of its own, so skill releases and renames
// propagate to stale CLIs without a CLI release.
async function fetchSkillBundle(): Promise<SkillBundle> {
    const raw = await fetchJson(MARKETPLACE_URL)
    if (raw === null) {
        throw new CliError("marketplace_unreachable", `Could not fetch the Terse skill list from ${MARKETPLACE_URL}.`, {
            detail: "Check your network connection and try again."
        })
    }
    const parsed = marketplaceSchema.safeParse(raw)
    if (!parsed.success) {
        throw new CliError("marketplace_malformed", "The published Terse plugin manifest is malformed. Please report this at https://github.com/TerseAI/Terse/issues.")
    }
    const skills = parsed.data.plugins.flatMap(plugin => plugin.skills ?? []).map(skillPath => path.posix.basename(skillPath))
    if (skills.length === 0) {
        throw new CliError("no_skills_published", "The published Terse plugin manifest lists no skills. Please report this at https://github.com/TerseAI/Terse/issues.")
    }
    return { version: parsed.data.metadata?.version ?? "unknown", skills }
}

async function fetchJson(url: string): Promise<unknown> {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) return null
        return await response.json()
    } catch {
        return null
    }
}

async function installSkillBundle(bundle: SkillBundle): Promise<void> {
    log.step(`Installing Terse skills into your coding agents: ${bundle.skills.join(", ")}`)
    const skillFlags = bundle.skills.flatMap(skill => ["--skill", skill])
    const command = ["npx", "-y", "skills@latest", "add", REPO_SLUG, "-y", "-g", ...skillFlags]
    await runStreaming(command[0], command.slice(1))
}

async function updateSkillBundle(bundle: SkillBundle): Promise<void> {
    log.step(`Updating Terse skills in your coding agents: ${bundle.skills.join(", ")}`)
    const skillFlags = bundle.skills.flatMap(skill => ["--skill", skill])
    const command = ["npx", "-y", "skills@latest", "update", REPO_SLUG, "-y", "-g", ...skillFlags]
    await runStreaming(command[0], command.slice(1))
}

async function offerClaudePermissions(opts?: NonInteractiveOpts): Promise<void> {
    const claudeDir = path.join(os.homedir(), ".claude")
    if (!fs.existsSync(claudeDir)) return
    if (isNonInteractive(opts)) {
        log.info(`To let Claude Code run terse commands without prompting, add "${CLAUDE_PERMISSION_RULE}" to permissions.allow in ~/.claude/settings.json.`)
        return
    }

    const settingsPath = path.join(claudeDir, "settings.json")
    const settings = readClaudeSettings(settingsPath)
    if (settings === null) {
        log.warn("~/.claude/settings.json is not valid JSON — skipping Claude Code permission setup.")
        return
    }
    const allow = settings.permissions?.allow ?? []
    if (allow.includes(CLAUDE_PERMISSION_RULE)) return

    const shouldAdd = await confirm({
        message: `Allow Claude Code to run terse commands without prompting? Adds "${CLAUDE_PERMISSION_RULE}" to ~/.claude/settings.json`,
        initialValue: false
    })
    if (isCancel(shouldAdd) || !shouldAdd) return

    const updated = { ...settings, permissions: { ...settings.permissions, allow: [...allow, CLAUDE_PERMISSION_RULE] } }
    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + "\n")
    log.step("Added terse to Claude Code's allowed permissions.")
}

function readClaudeSettings(settingsPath: string): ClaudeSettings | null {
    if (!fs.existsSync(settingsPath)) return {}
    const raw = readJsonFile(settingsPath)
    if (raw === null) return null
    const parsed = claudeSettingsSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
}

async function ensureAuth(opts?: NonInteractiveOpts): Promise<void> {
    if (getStoredApiKey()) return
    if (isNonInteractive(opts)) {
        log.info("Not logged in. Run `terse auth login` when ready.")
        return
    }
    const shouldLogin = await confirm({ message: "Log in to Terse Cloud now?" })
    if (isCancel(shouldLogin) || !shouldLogin) {
        log.info("You can log in later with `terse auth login`.")
        return
    }
    await loginAndPersist()
}

async function isOnPath(bin: string): Promise<boolean> {
    try {
        await execFile(bin, ["--version"])
        return true
    } catch {
        return false
    }
}

function readJsonFile(filePath: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"))
    } catch {
        return null
    }
}

function runStreaming(command: string, args: string[]): Promise<void> {
    return new Promise((resolvePromise, rejectPromise) => {
        // When this CLI itself runs under npx (`npx terse-cli install`), npm exports its
        // config as npm_config_* env vars (including npm_config_package pointing at
        // terse-cli). Child npm/npx invocations inherit them and resolve the wrong
        // package, so spawn children with those vars stripped.
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith("npm_config_")))
        const child = spawn(command, args, { stdio: "inherit", env })
        child.on("error", rejectPromise)
        child.on("close", code => {
            if (code === 0) {
                resolvePromise()
            } else {
                rejectPromise(new CliError("subprocess_failed", `\`${command} ${args.join(" ")}\` exited with code ${code}.`))
            }
        })
    })
}

// Types

const marketplaceSchema = z.looseObject({
    metadata: z.looseObject({ version: z.string().optional() }).optional(),
    plugins: z.array(z.looseObject({ skills: z.array(z.string()).optional() }))
})

const claudeSettingsSchema = z.looseObject({
    permissions: z.looseObject({ allow: z.array(z.string()).optional() }).optional()
})

type SkillBundle = {
    version: string
    skills: string[]
}

type ClaudeSettings = z.infer<typeof claudeSettingsSchema>
