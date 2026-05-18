import chalk from "chalk"

import { ApiError, fetchWithAuth } from "../api.js"
import { getStoredApiKey } from "../userConfig.js"

interface MeResponse {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    displayName: string | null
    organizationId: string
    organization: { id: string; name: string } | null
}

export async function authStatus(): Promise<void> {
    const apiKey = getStoredApiKey()
    if (!apiKey) {
        console.log("Not logged in. Run `terse auth login`.")
        process.exit(1)
    }

    let me: MeResponse
    try {
        me = await fetchWithAuth<MeResponse>("/sdk/me", apiKey)
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
            console.log("Credentials expired. Run `terse auth login`.")
            process.exit(1)
        }
        throw err
    }

    const name = me.displayName || me.email
    const orgName = me.organization?.name ?? "(no organization)"
    const orgId = me.organization?.id ?? me.organizationId
    console.log(`User: ${name} ${chalk.dim(me.email)}`)
    console.log(`Org:  ${orgName} ${chalk.dim(orgId)}`)
}
