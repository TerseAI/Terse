import { logProviderBanner } from "../../common/providerBanner"
import { settings } from "../../settings"

import { LocalSandboxService } from "./LocalSandboxService"
import { ModalSandboxService } from "./ModalSandboxService"
import { SandboxService } from "./SandboxService"

const sandboxProvider: SandboxService = (() => {
    if (settings.modal) {
        logProviderBanner("remote", "SANDBOX PROVIDER: MODAL", "container-isolated, production-grade")
        return ModalSandboxService.getInstance()
    }
    logProviderBanner("local", "SANDBOX PROVIDER: LOCAL", "subprocess on host, NO container isolation")
    return new LocalSandboxService()
})()

export function getSandboxProvider(): SandboxService {
    return sandboxProvider
}
