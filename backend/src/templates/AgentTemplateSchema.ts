import { z } from "zod"

import {
    ConfluenceConfigSchema,
    DatadogConfigSchema,
    FigmaConfigSchema,
    GitHubConfigSchema,
    GmailConfigSchema,
    GmailDraftOutputConfigSchema,
    GmailOutputConfigSchema,
    JiraConfigSchema,
    LaunchDarklyConfigSchema,
    LinearInputConfigSchema,
    LinearOutputConfigSchema,
    NotionConfigSchema,
    PosthogConfigSchema,
    SlackConfigSchema,
    SlackOutputConfigSchema,
    TimeTriggerConfigSchema,
    WorkOSInputConfigSchema
} from "../utility/configSchemas"

function asTemplateConfigSchema<T extends z.AnyZodObject>(schema: T): z.ZodDiscriminatedUnionOption<"configType"> {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    const configTypeSchema = shape.configType
    const integrationTypeSchema = shape.integrationType

    if (!configTypeSchema || !integrationTypeSchema) {
        throw new Error("Template config schemas must define configType and integrationType.")
    }

    return schema.partial().extend({
        // Preserve discriminants while still allowing templates to omit unresolved values.
        configType: configTypeSchema,
        integrationType: integrationTypeSchema,
        integrationId: z.string().optional()
    }) as z.ZodDiscriminatedUnionOption<"configType">
}

// Union of all config schemas
export const ConfigTemplateSchema = z.discriminatedUnion("configType", [
    asTemplateConfigSchema(GmailConfigSchema),
    asTemplateConfigSchema(GmailOutputConfigSchema),
    asTemplateConfigSchema(GmailDraftOutputConfigSchema),
    asTemplateConfigSchema(FigmaConfigSchema),
    asTemplateConfigSchema(SlackConfigSchema),
    asTemplateConfigSchema(SlackOutputConfigSchema),
    asTemplateConfigSchema(NotionConfigSchema),
    asTemplateConfigSchema(LinearInputConfigSchema),
    asTemplateConfigSchema(LinearOutputConfigSchema),
    asTemplateConfigSchema(GitHubConfigSchema),
    asTemplateConfigSchema(JiraConfigSchema),
    asTemplateConfigSchema(ConfluenceConfigSchema),
    asTemplateConfigSchema(PosthogConfigSchema),
    asTemplateConfigSchema(LaunchDarklyConfigSchema),
    asTemplateConfigSchema(DatadogConfigSchema),
    asTemplateConfigSchema(WorkOSInputConfigSchema),
    asTemplateConfigSchema(TimeTriggerConfigSchema)
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
        actionTypes: z.array(z.enum(["create", "update", "delete", "read"] as const)),
        notifyOnRunFailure: z.boolean().optional().default(false)
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
        readOnly: z.boolean().optional().default(false),
        config: ConfigTemplateSchema
    })
    .strict()

// Template category schema
const TemplateCategorySchema = z.enum(["ship", "users", "sync", "track"])

// Main Agent template schema
export const AgentTemplateSchema = z
    .object({
        id: z.string().min(1, "Template id is required"),
        category: TemplateCategorySchema,
        name: z.string().min(1, "Template name is required"),
        description: z.string().min(1, "Template description is required"),
        prompt: AgentPromptSchema,
        triggers: z.array(AgentTriggerTemplateSchema).min(1, "At least one trigger is required"),
        outputs: z.array(AgentOutputTemplateSchema).min(1, "At least one output is required"),
        requireApproval: z.boolean().optional().default(false),
        chatPrompt: z.string().min(1, "Template chatPrompt is required"),
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
export function parseTemplates(templates: unknown): AgentTemplates {
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

    return result.data
}

export function validateTemplates(templates: unknown): asserts templates is AgentTemplates {
    parseTemplates(templates)
}
