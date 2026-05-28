import { logProviderBanner } from "../../common/providerBanner"
import { WorkOSAuthProvider } from "../../ee/services/authProvider/WorkOSAuthProvider"
import { settings } from "../../settings"

import AuthProvider from "./AuthProvider"
import { LocalAuthProvider } from "./LocalAuthProvider"

const authProvider: AuthProvider = (() => {
    if (settings.workos) {
        logProviderBanner("remote", "AUTH PROVIDER: WORKOS", "SSO + multi-org")
        return new WorkOSAuthProvider()
    }
    logProviderBanner("local", "AUTH PROVIDER: LOCAL", "single-user, no login screen")
    return new LocalAuthProvider()
})()

export function getAuthProvider(): AuthProvider {
    return authProvider
}
