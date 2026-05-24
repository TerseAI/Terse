import logger from "../../common/logger"
import { WorkOSAuthProvider } from "../../ee/services/authProvider/WorkOSAuthProvider"
import { settings } from "../../settings"

import AuthProvider from "./AuthProvider"
import { LocalAuthProvider } from "./LocalAuthProvider"

const authProvider: AuthProvider = (() => {
    if (settings.workos) {
        logger.info("Using auth provider: workos")
        return new WorkOSAuthProvider()
    }
    logger.info("Using auth provider: local")
    return new LocalAuthProvider()
})()

export function getAuthProvider(): AuthProvider {
    return authProvider
}
