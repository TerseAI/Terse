import { z } from "zod"

import { ConfigType } from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"

// Base config schema - all configs have integrationId and configType
const BaseConfigSchema = z
    .object({
        integrationId: z.string().optional(), // Optional in templates, will be filled when creating agent
        configType: z.nativeEnum(ConfigType),
        integrationType: z.nativeEnum(IntegrationType)
    })
    .strict()

// Gmail config schema
const GmailConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL),
    integrationType: z.literal(IntegrationType.GMAIL)
})

// Figma config schema
const FigmaConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.FIGMA),
    integrationType: z.literal(IntegrationType.FIGMA),
    fileKey: z.string().optional(),
    fileName: z.string().optional(),
    teamId: z.string().optional()
})

// Slack config schema
const SlackConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: z.string().optional(),
    channelName: z.string().optional(),
    listenToUserDms: z.boolean().optional(),
    userIds: z.array(z.string()).optional()
})

// Slack Output config schema
const SlackOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_OUTPUT),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: z.string().optional(),
    channelName: z.string().optional()
})

// Notion Database config schema
const NotionDatabaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_DATABASE),
    integrationType: z.literal(IntegrationType.NOTION),
    databaseId: z.string().optional(),
    databaseName: z.string().optional()
})

// Notion Page config schema
const NotionPageConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_PAGE),
    integrationType: z.literal(IntegrationType.NOTION),
    pageId: z.string().optional(),
    pageName: z.string().optional()
})

// Linear Trigger config schema
const LinearTriggerConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_INPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    projectId: z.string().optional(),
    projectName: z.string().optional()
})

// Linear Output config schema
const LinearOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_OUTPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: z.string().optional(),
    teamName: z.string().optional()
})

// GitHub config schema
const GitHubConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).optional()
})

// GitHub Knowledge Base config schema
const GitHubKBConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB_KB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).optional(),
    repositoryNames: z.array(z.string()).optional()
})

// Jira config schema
const JiraConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.JIRA),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    projectKey: z.string().optional(),
    projectId: z.string().optional()
})

// Confluence config schema
const ConfluenceConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.CONFLUENCE),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    spaceName: z.string().optional(),
    spaceId: z.string().optional(),
    pageId: z.string().optional(),
    pageName: z.string().optional()
})

// Posthog config schema
const PosthogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.POSTHOG),
    integrationType: z.literal(IntegrationType.POSTHOG),
    projectId: z.string().optional(),
    projectName: z.string().optional()
})

// Linear Knowledge Base config schema
const LinearKBConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_KB),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: z.string().optional(),
    teamName: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional()
})

// Slack Knowledge Base config schema
const SlackKBConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_KB),
    integrationType: z.literal(IntegrationType.SLACK),
    channelIds: z.array(z.string()).optional(),
    channelNames: z.array(z.string()).optional(),
    allowDms: z.boolean().optional()
})

// Time Trigger config schema
const TimeTriggerConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.TIME_TRIGGER),
    integrationType: z.literal(IntegrationType.CRON_JOB),
    cronExpression: z.string()
})

// Union of all config schemas
export const ConfigTemplateSchema = z.discriminatedUnion("configType", [
    GmailConfigSchema,
    FigmaConfigSchema,
    SlackConfigSchema,
    SlackOutputConfigSchema,
    NotionDatabaseConfigSchema,
    NotionPageConfigSchema,
    LinearTriggerConfigSchema,
    LinearOutputConfigSchema,
    GitHubConfigSchema,
    GitHubKBConfigSchema,
    JiraConfigSchema,
    ConfluenceConfigSchema,
    PosthogConfigSchema,
    LinearKBConfigSchema,
    SlackKBConfigSchema,
    TimeTriggerConfigSchema
])

// Agent prompt schema
const AgentPromptSchema = z
    .object({
        text: z.string().min(1, "Prompt text is required and cannot be empty")
    })
    .strict()

// Agent notification settings schema
const AgentNotificationSettingsSchema = z
    .object({
        enabled: z.boolean(),
        actionTypes: z.array(z.enum(["create", "update", "delete", "read"] as const))
    })
    .optional()

// Agent trigger template schema
const AgentTriggerTemplateSchema = z
    .object({
        id: z.string().optional(), // Optional in templates
        config: ConfigTemplateSchema
    })
    .strict()

// Agent output template schema
const AgentOutputTemplateSchema = z
    .object({
        id: z.string().optional(), // Optional in templates
        config: ConfigTemplateSchema
    })
    .strict()

// Agent knowledge base template schema
const AgentKnowledgeBaseTemplateSchema = z
    .object({
        id: z.string().optional(), // Optional in templates
        config: ConfigTemplateSchema
    })
    .strict()

// Main Agent template schema
export const AgentTemplateSchema = z
    .object({
        name: z.string().min(1, "Template name is required"),
        description: z.string().min(1, "Template description is required"),
        prompt: AgentPromptSchema,
        triggers: z.array(AgentTriggerTemplateSchema).min(1, "At least one trigger is required"),
        outputs: z.array(AgentOutputTemplateSchema).min(1, "At least one output is required"),
        knowledgeBases: z.array(AgentKnowledgeBaseTemplateSchema).optional(),
        requireApproval: z.boolean().optional().default(false),
        chatPrompt: z.string().optional(),
        isActive: z.boolean().optional().default(true),
        notificationSettings: AgentNotificationSettingsSchema
    })
    .strict() // Strict mode: no extra properties allowed

// Schema for the templates.json file (array of templates)
export const AgentTemplatesSchema = z.array(AgentTemplateSchema).min(1, "At least one template is required")

// Type exports
export type AgentTemplate = z.infer<typeof AgentTemplateSchema>
export type ConfigTemplate = z.infer<typeof ConfigTemplateSchema>
export type AgentTemplates = z.infer<typeof AgentTemplatesSchema>

/**
 * Validates templates and throws a detailed error if validation fails.
 * This function should be called at startup to ensure all templates are valid.
 *
 * @param templates - The templates to validate
 * @throws {Error} If validation fails, with detailed error messages
 */
export function validateTemplates(templates: unknown): asserts templates is AgentTemplates {
    const result = AgentTemplatesSchema.safeParse(templates)

    if (!result.success) {
        const errors = result.error.errors
        const errorMessages = errors
            .map((error, index) => {
                const path = error.path.join(".")
                const templateIndex = error.path[0] as number | undefined
                const templateName =
                    templateIndex !== undefined && typeof templates === "object" && templates !== null && Array.isArray(templates)
                        ? (templates[templateIndex] as any)?.name || `Template at index ${templateIndex}`
                        : "Unknown template"

                return `  ${index + 1}. ${templateName}: ${path ? `${path} - ` : ""}${error.message}`
            })
            .join("\n")

        throw new Error(
            `Template validation failed! The templates.json file contains invalid data.\n\n` + `Errors:\n${errorMessages}\n\n` + `Please fix these issues before the application can start.`
        )
    }
}
