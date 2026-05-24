import logger from "../../common/logger"
import { WorkOSOrganizationProvider } from "../../ee/services/organizationProvider/WorkOSOrganizationProvider"
import { settings } from "../../settings"

import { LocalOrganizationProvider } from "./LocalOrganizationProvider"
import OrganizationProvider from "./OrganizationProvider"

const organizationProvider: OrganizationProvider = (() => {
    if (settings.workos) {
        logger.info("Using organization provider: workos")
        return new WorkOSOrganizationProvider()
    }
    logger.info("Using organization provider: local")
    return new LocalOrganizationProvider()
})()

export function getOrganizationProvider(): OrganizationProvider {
    return organizationProvider
}
