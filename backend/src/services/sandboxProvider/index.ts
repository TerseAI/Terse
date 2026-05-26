import logger from "../../common/logger"
import { settings } from "../../settings"

import { LocalSandboxService } from "./LocalSandboxService"
import { ModalSandboxService } from "./ModalSandboxService"
import { SandboxService } from "./SandboxService"

const sandboxProvider: SandboxService = (() => {
    if (settings.modal) {
        logger.info("Using sandbox provider: modal")
        return new ModalSandboxService()
    }
    logger.info("Using sandbox provider: local (subprocess, no container isolation)")
    return new LocalSandboxService()
})()

export function getSandboxProvider(): SandboxService {
    return sandboxProvider
}
