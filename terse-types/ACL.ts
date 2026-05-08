import * as z from "zod"

import { IntegrationType } from "./Integrations"

const baseACLRuleSchema = z.object({
    integrationId: z.string(),
    resourceId: z.string()
})

export const slackACLResourceTypeSchema = z.enum(["channel", "dm_user"])
export type SlackACLResourceType = z.infer<typeof slackACLResourceTypeSchema>

export const notionACLResourceTypeSchema = z.enum(["page", "database"])
export type NotionACLResourceType = z.infer<typeof notionACLResourceTypeSchema>

export const githubACLResourceTypeSchema = z.literal("repository")
export type GitHubACLResourceType = z.infer<typeof githubACLResourceTypeSchema>

export const gmailACLResourceTypeSchema = z.enum(["send", "draft"])
export type GmailACLResourceType = z.infer<typeof gmailACLResourceTypeSchema>

/** Built-in web / image capabilities use `IntegrationType.TERSE` in configs; resourceType distinguishes them. */
export const terseACLResourceTypeSchema = z.enum(["web_capability", "image_edit_capability"])
export type TerseACLResourceType = z.infer<typeof terseACLResourceTypeSchema>

export const linearACLResourceTypeSchema = z.enum(["integration", "team", "project"])
export type LinearACLResourceType = z.infer<typeof linearACLResourceTypeSchema>

export const posthogACLResourceTypeSchema = z.literal("project")
export type PosthogACLResourceType = z.infer<typeof posthogACLResourceTypeSchema>

export const datadogACLResourceTypeSchema = z.enum(["integration", "index"])
export type DatadogACLResourceType = z.infer<typeof datadogACLResourceTypeSchema>

export const launchDarklyACLResourceTypeSchema = z.enum(["project", "environment"])
export type LaunchDarklyACLResourceType = z.infer<typeof launchDarklyACLResourceTypeSchema>

export const attioACLResourceTypeSchema = z.enum(["integration", "object"])
export type AttioACLResourceType = z.infer<typeof attioACLResourceTypeSchema>

export const workosACLResourceTypeSchema = z.enum(["integration", "organization"])
export type WorkOSACLResourceType = z.infer<typeof workosACLResourceTypeSchema>

export const snowflakeACLResourceTypeSchema = z.literal("integration")
export type SnowflakeACLResourceType = z.infer<typeof snowflakeACLResourceTypeSchema>

export const slackACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.SLACK),
    resourceType: slackACLResourceTypeSchema
})

export const notionACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.NOTION),
    resourceType: notionACLResourceTypeSchema
})

export const githubACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.GITHUB),
    resourceType: githubACLResourceTypeSchema
})

export const gmailACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.GMAIL),
    resourceType: gmailACLResourceTypeSchema
})

export const terseACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.TERSE),
    resourceType: terseACLResourceTypeSchema
})

export const linearACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.LINEAR),
    resourceType: linearACLResourceTypeSchema
})

export const posthogACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.POSTHOG),
    resourceType: posthogACLResourceTypeSchema
})

export const datadogACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.DATADOG),
    resourceType: datadogACLResourceTypeSchema
})

export const launchDarklyACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.LAUNCHDARKLY),
    resourceType: launchDarklyACLResourceTypeSchema
})

export const attioACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.ATTIO),
    resourceType: attioACLResourceTypeSchema
})

export const workosACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.WORKOS),
    resourceType: workosACLResourceTypeSchema
})

export const snowflakeACLRuleSchema = baseACLRuleSchema.extend({
    integrationType: z.literal(IntegrationType.SNOWFLAKE),
    resourceType: snowflakeACLResourceTypeSchema
})

export const aclRuleSchema = z.discriminatedUnion("integrationType", [
    slackACLRuleSchema,
    notionACLRuleSchema,
    githubACLRuleSchema,
    gmailACLRuleSchema,
    terseACLRuleSchema,
    linearACLRuleSchema,
    posthogACLRuleSchema,
    datadogACLRuleSchema,
    launchDarklyACLRuleSchema,
    attioACLRuleSchema,
    workosACLRuleSchema,
    snowflakeACLRuleSchema
])

export const aclRulesSchema = z.array(aclRuleSchema)

export type ACLRule = z.infer<typeof aclRuleSchema>

export type SlackACLRule = z.infer<typeof slackACLRuleSchema>
export type NotionACLRule = z.infer<typeof notionACLRuleSchema>
export type GitHubACLRule = z.infer<typeof githubACLRuleSchema>
export type GmailACLRule = z.infer<typeof gmailACLRuleSchema>
export type TerseACLRule = z.infer<typeof terseACLRuleSchema>
export type WebACLRule = TerseACLRule & { resourceType: "web_capability" }
export type ImageEditACLRule = TerseACLRule & { resourceType: "image_edit_capability" }
export type LinearACLRule = z.infer<typeof linearACLRuleSchema>
export type PosthogACLRule = z.infer<typeof posthogACLRuleSchema>
export type DatadogACLRule = z.infer<typeof datadogACLRuleSchema>
export type LaunchDarklyACLRule = z.infer<typeof launchDarklyACLRuleSchema>
export type AttioACLRule = z.infer<typeof attioACLRuleSchema>
export type WorkOSACLRule = z.infer<typeof workosACLRuleSchema>
export type SnowflakeACLRule = z.infer<typeof snowflakeACLRuleSchema>

export function findACLRule(rules: ACLRule[], rule: Pick<ACLRule, "integrationType" | "integrationId" | "resourceType" | "resourceId">): ACLRule | undefined {
    return rules.find(
        candidate =>
            candidate.integrationType === rule.integrationType &&
            candidate.integrationId === rule.integrationId &&
            candidate.resourceType === rule.resourceType &&
            candidate.resourceId === rule.resourceId
    )
}

export function hasACLRule(rules: ACLRule[], rule: Pick<ACLRule, "integrationType" | "integrationId" | "resourceType" | "resourceId">): boolean {
    return !!findACLRule(rules, rule)
}

export function getACLRulesForResourceType(params: { rules: ACLRule[]; integrationType: ACLRule["integrationType"]; integrationId: string; resourceType: ACLRule["resourceType"] }): ACLRule[] {
    return params.rules.filter(rule => rule.integrationType === params.integrationType && rule.integrationId === params.integrationId && rule.resourceType === params.resourceType)
}

export function hasAnyACLRuleForIntegration(params: { rules: ACLRule[]; integrationType: ACLRule["integrationType"]; integrationId: string }): boolean {
    return params.rules.some(rule => rule.integrationType === params.integrationType && rule.integrationId === params.integrationId)
}

/**
 * ACL validators are colocated with the output/tool definitions they protect.
 * Each validator receives model tool args, the flat per-run `ACLRule[]`, and run configs (`readOnly`, `integrationId`).
 * Validators decide in-scope only; they must not persist ACL state, mutate configs, or affect deterministic developer-authored tool calls.
 */
export function getACLRulesForIntegration(params: { rules: ACLRule[]; integrationType: ACLRule["integrationType"]; integrationId: string }): ACLRule[] {
    return params.rules.filter(rule => rule.integrationType === params.integrationType && rule.integrationId === params.integrationId)
}
