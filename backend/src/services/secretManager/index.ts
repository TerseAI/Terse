import chalk from "chalk"

import logger from "../../common/logger"
import { GoogleSecretManagerClient } from "../../ee/services/secretManager/GoogleSecretManagerClient"
import { settings } from "../../settings"

import { LocalSecretManagerClient } from "./LocalSecretManagerClient"
import { SecretManagerClient } from "./SecretManagerClient"

const secretManagerClient: SecretManagerClient = (() => {
    if (settings.gcp) {
        logBanner(chalk.cyan, "SECRET MANAGER: GOOGLE", "GCP Secret Manager")
        return new GoogleSecretManagerClient()
    }
    logBanner(chalk.yellow, "SECRET MANAGER: LOCAL", "SQLite, Fernet-encrypted at rest")
    return new LocalSecretManagerClient()
})()

function logBanner(color: (s: string) => string, title: string, subtitle: string): void {
    const width = Math.max(title.length, subtitle.length) + 4
    const bar = "═".repeat(width)
    const pad = (s: string) => `║ ${s.padEnd(width - 2)} ║`
    logger.info(["", color(`╔${bar}╗`), color(pad(title)), color(pad(subtitle)), color(`╚${bar}╝`), ""].join("\n"))
}

export function getSecretManagerClient(): SecretManagerClient {
    return secretManagerClient
}
