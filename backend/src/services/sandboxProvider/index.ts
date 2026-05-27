import chalk from "chalk"

import logger from "../../common/logger"
import { settings } from "../../settings"

import { LocalSandboxService } from "./LocalSandboxService"
import { ModalSandboxService } from "./ModalSandboxService"
import { SandboxService } from "./SandboxService"

const sandboxProvider: SandboxService = (() => {
    if (settings.modal) {
        logBanner(chalk.cyan, "SANDBOX PROVIDER: MODAL", "container-isolated, production-grade")
        return new ModalSandboxService()
    }
    logBanner(chalk.yellow, "SANDBOX PROVIDER: LOCAL", "subprocess on host, NO container isolation")
    return new LocalSandboxService()
})()

function logBanner(color: (s: string) => string, title: string, subtitle: string): void {
    const width = Math.max(title.length, subtitle.length) + 4
    const bar = "═".repeat(width)
    const pad = (s: string) => `║ ${s.padEnd(width - 2)} ║`
    logger.info(["", color(`╔${bar}╗`), color(pad(title)), color(pad(subtitle)), color(`╚${bar}╝`), ""].join("\n"))
}

export function getSandboxProvider(): SandboxService {
    return sandboxProvider
}
