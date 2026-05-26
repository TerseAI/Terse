import logger from "../../common/logger"
import { GoogleSecretManagerClient } from "../../ee/services/secretManager/GoogleSecretManagerClient"
import { settings } from "../../settings"

import { LocalSecretManagerClient } from "./LocalSecretManagerClient"
import { SecretManagerClient } from "./SecretManagerClient"

const secretManagerClient: SecretManagerClient = (() => {
    if (settings.gcp) {
        logger.info("Using secret manager: google")
        return new GoogleSecretManagerClient()
    }
    logger.info("Using secret manager: local (SQLite, Fernet-encrypted)")
    return new LocalSecretManagerClient()
})()

export function getSecretManagerClient(): SecretManagerClient {
    return secretManagerClient
}
