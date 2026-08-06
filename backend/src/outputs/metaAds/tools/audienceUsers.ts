import type { MetaAdsAudienceUser } from "terse-types"
import { z } from "zod"

import { MetaAdsClient, hashEmail, hashPhone } from "../../../integrations/metaAds/apiClient"

export async function applyAudienceUsers(client: MetaAdsClient, args: { audienceId: string; users: readonly MetaAdsAudienceUser[]; mode: "add" | "remove" }) {
    const payload = buildHashedUsersPayload(args.users)
    const audience = client.customAudience(args.audienceId)
    const response = await client.runParsed(
        () => (args.mode === "add" ? audience.createUser([], { payload }) : audience.deleteUsers({ payload })),
        audienceUsersResponseSchema,
        "audience users update"
    )

    return {
        audienceId: args.audienceId,
        numReceived: response.num_received,
        numInvalidEntries: response.num_invalid_entries ?? 0
    }
}

const audienceUsersResponseSchema = z.object({
    audience_id: z.string().optional(),
    num_received: z.number(),
    num_invalid_entries: z.number().optional()
})

// Multi-key schema upload: missing keys are sent as empty strings, per the Marketing API contract.
function buildHashedUsersPayload(users: readonly MetaAdsAudienceUser[]): { schema: string[]; data: string[][] } {
    const invalid = users.filter(user => !user.email && !user.phone && !user.externalId)
    if (invalid.length > 0) {
        throw new Error(`${invalid.length} user(s) have no email, phone, or externalId; each user needs at least one match key.`)
    }

    return {
        schema: ["EMAIL", "PHONE", "EXTERN_ID"],
        data: users.map(user => [user.email ? hashEmail(user.email) : "", user.phone ? hashPhone(user.phone) : "", user.externalId ?? ""])
    }
}
