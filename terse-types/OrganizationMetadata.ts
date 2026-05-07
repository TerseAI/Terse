import { z } from "zod"

// Can be serialized a string, supports deserialization
const booleanMetadataSchema = z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(value => value === true || value === "true")

export const organizationMetadataSchema = z.object({
    stripeCustomerId: z.string(),
    runExecutionBlocked: booleanMetadataSchema
})

export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>
