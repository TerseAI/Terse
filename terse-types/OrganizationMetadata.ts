import * as z from "zod"

export const organizationMetadataSchema = z.object({
    stripeCustomerId: z.string(),
    overageMode: z.enum(["soft", "strict"]),
    overageCapMultiplier: z.string().transform(val => Number(val))
})

export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>
