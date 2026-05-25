import { confirm } from "@inquirer/prompts"
import * as tabtab from "@pnpm/tabtab"
import chalk from "chalk"
import type { Command, Option } from "commander"
import path from "node:path"

import { isNonInteractive } from "../cliHelpers.js"
import { hasCompletionPromptBeenAsked, markCompletionPromptAsked } from "../userConfig.js"

const BINARY = "terse"

export async function completionInstall(): Promise<void> {
    await tabtab.install({ name: BINARY, completer: BINARY, shell: detectShellFromEnv() })
    markCompletionPromptAsked()
    console.log(chalk.green(`\n  Tab completion installed for \`${BINARY}\`.`))
    console.log(chalk.dim(`  Open a new shell or source your shell config to activate it.\n`))
}

export async function completionUninstall(): Promise<void> {
    await tabtab.uninstall({ name: BINARY })
    console.log(chalk.green(`\n  Tab completion uninstalled for \`${BINARY}\`.\n`))
}

export function completionHandler(rootProgram: Command): void {
    const env = tabtab.parseEnv(process.env)
    if (!env.complete) return

    const shell = tabtab.getShellFromEnv(process.env)
    const target = resolveTarget(rootProgram, env.line)
    const suggestions = buildSuggestions(target.command, env.last, target.usedFlags)
    tabtab.log(suggestions, shell)
}

export async function maybePromptForCompletion(actionCommand: Command): Promise<void> {
    if (!shouldPromptForCompletion(actionCommand)) return

    let answer: boolean
    try {
        answer = await confirm({ message: "Enable tab completion for `terse`?", default: true })
    } catch {
        return
    }
    markCompletionPromptAsked()
    if (!answer) return

    try {
        await completionInstall()
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(chalk.yellow(`\n  Failed to install tab completion: ${message}`))
        console.error(chalk.dim(`  Run \`terse completion install\` to try again.\n`))
    }
}

function shouldPromptForCompletion(actionCommand: Command): boolean {
    if (isDescendantOfCompletion(actionCommand)) return false
    const opts = actionCommand.optsWithGlobals()
    if (isNonInteractive(opts)) return false
    if (opts.json) return false
    if (!detectShellFromEnv()) return false
    if (hasCompletionPromptBeenAsked()) return false
    return true
}

function isDescendantOfCompletion(cmd: Command): boolean {
    let current: Command | null = cmd
    while (current) {
        if (current.name() === "completion") return true
        current = current.parent ?? null
    }
    return false
}

function detectShellFromEnv(): SupportedShell | undefined {
    const shellPath = process.env.SHELL
    if (!shellPath) return undefined
    const base = path.basename(shellPath)
    return tabtab.isShellSupported(base) ? base : undefined
}

function resolveTarget(rootProgram: Command, line: string): TargetResolution {
    const tokens = tokenize(line).slice(1)
    const trailingSpace = /\s$/.test(line)
    let current: Command = rootProgram
    const usedFlags = new Set<string>()

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        const isPartial = i === tokens.length - 1 && !trailingSpace
        if (isPartial) break

        if (token.startsWith("-")) {
            usedFlags.add(token)
            continue
        }

        const next = current.commands.find(c => c.name() === token || c.aliases().includes(token))
        if (next) current = next
    }

    return { command: current, usedFlags }
}

function buildSuggestions(command: Command, partial: string, usedFlags: Set<string>): tabtab.CompletionItem[] {
    const items: tabtab.CompletionItem[] = []
    const completingFlag = partial.startsWith("-")

    if (!completingFlag) {
        for (const sub of command.commands) {
            const name = sub.name()
            if (!startsWith(name, partial)) continue
            items.push({ name, description: sub.description() })
        }
    }

    for (const option of command.options) {
        for (const flag of optionFlags(option)) {
            if (usedFlags.has(flag)) continue
            if (!startsWith(flag, partial)) continue
            items.push({ name: flag, description: option.description })
        }
    }

    return items
}

function optionFlags(option: Option): string[] {
    return [option.short, option.long].filter((f): f is string => Boolean(f))
}

function startsWith(candidate: string, partial: string): boolean {
    if (!partial) return true
    return candidate.startsWith(partial)
}

function tokenize(line: string): string[] {
    return line.split(/\s+/).filter(part => part.length > 0)
}

type TargetResolution = {
    command: Command
    usedFlags: Set<string>
}

type SupportedShell = tabtab.SupportedShell
