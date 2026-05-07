import * as z from "zod"

export const organizationMetadataSchema = z.object({
    stripeCustomerId: z.string()
})

export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>
