import { z } from "zod"

// Can be serialized a string, supports deserialization
const booleanMetadataSchema = z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(value => value === true || value === "true")

export const organizationMetadataSchema = z.object({
    subscriptionPurchaserUserId: z.string().optional(),
    subscriptionId: z.string().optional(),
    metronomeCustomerId: z.string().optional(),
    runExecutionBlocked: booleanMetadataSchema
})
export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>

export const userMetadataSchema = z.object({
    db_id: z.string().optional(),
    stripeCustomerId: z.string().optional()
})
export type UserMetadata = z.infer<typeof userMetadataSchema>
