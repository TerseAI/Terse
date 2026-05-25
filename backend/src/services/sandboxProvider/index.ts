import logger from "../../common/logger"
import { settings } from "../../settings"

import { InMemorySandboxService } from "./InMemorySandboxService"
import { ModalSandboxService } from "./ModalSandboxService"
import { SandboxService } from "./SandboxService"

const sandboxProvider: SandboxService = (() => {
    if (settings.modal) {
        logger.info("Using sandbox provider: modal")
        return new ModalSandboxService()
    }
    logger.info("Using sandbox provider: in-memory (single-process, no containers)")
    return new InMemorySandboxService()
})()

export function getSandboxProvider(): SandboxService {
    return sandboxProvider
}
