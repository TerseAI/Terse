import { logProviderBanner } from "../../common/providerBanner"
import { GoogleSecretManagerClient } from "../../ee/services/secretManager/GoogleSecretManagerClient"
import { settings } from "../../settings"

import { LocalSecretManagerClient } from "./LocalSecretManagerClient"
import { SecretManagerClient } from "./SecretManagerClient"

const secretManagerClient: SecretManagerClient = (() => {
    if (settings.gcp) {
        logProviderBanner("remote", "SECRET MANAGER: GOOGLE", "GCP Secret Manager")
        return new GoogleSecretManagerClient()
    }
    logProviderBanner("local", "SECRET MANAGER: LOCAL", "SQLite, Fernet-encrypted at rest")
    return new LocalSecretManagerClient()
})()

export function getSecretManagerClient(): SecretManagerClient {
    return secretManagerClient
}
