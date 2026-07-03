import { SlackInputRequestProvider } from "./SlackInputRequestProvider"
import { InputRequestProvider } from "./types"

// Adding a provider: implement InputRequestProvider in a sibling file, register it here,
// and add its member to sdkInputRequestTargetSchema / sdkInputRequestDeliverySchema.
const providerList: InputRequestProvider[] = [new SlackInputRequestProvider()]

const providers: Record<string, InputRequestProvider> = Object.fromEntries(providerList.map(provider => [provider.provider, provider]))

export function getInputRequestProvider(provider: string): InputRequestProvider | null {
    return providers[provider] ?? null
}
