import { useState } from "react"

import { InstallationOptionsFor, IntegrationType } from "terse-types/Integrations"

import { BackendProvider } from "../services/backend"

export function useOAuthConnection<T extends IntegrationType>(integrationType: T, options: InstallationOptionsFor<T>, stateToken?: string) {
    const [isConnecting, setIsConnecting] = useState(false)

    const connect = async () => {
        setIsConnecting(true)
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(integrationType, options, stateToken)

            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, "oauth-popup", "width=600,height=700")
            }
        } catch {
            // OAuth initiation failed; user can retry
        } finally {
            setIsConnecting(false)
        }
    }

    return { connect, isConnecting }
}
