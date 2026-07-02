import { slackInputRequestProvider } from "./SlackInputRequestProvider"
import { InputRequestProvider } from "./types"

// Adding a provider: implement InputRequestProvider in a sibling file, register it here,
// and add its member to sdkInputRequestTargetSchema / sdkInputRequestDeliverySchema.
const providers: Record<string, InputRequestProvider> = {
    [slackInputRequestProvider.provider]: slackInputRequestProvider
}

export function getInputRequestProvider(provider: string): InputRequestProvider | null {
    return providers[provider] ?? null
}
