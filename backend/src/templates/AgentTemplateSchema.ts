import { configDataSchema } from "terse-types/Configs"
import { agentNotificationSettingsSchema, templateCategorySchema } from "terse-types/types"
import { z } from "zod"

function asTemplateConfigSchema<T extends z.ZodObject<any>>(schema: T) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    const configTypeSchema = shape.configType
    const integrationTypeSchema = shape.integrationType

    if (!configTypeSchema || !integrationTypeSchema) {
        throw new Error("Template config schemas must define configType and integrationType.")
    }

    return schema.partial().extend({
        configType: configTypeSchema,
        integrationType: integrationTypeSchema,
        integrationId: z.string().optional()
    })
}

const ConfigTemplateSchema = z.union(configDataSchema.options.map(schema => asTemplateConfigSchema(schema as z.ZodObject<any>)) as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])

const AgentPromptSchema = z
    .object({
        text: z.string().min(1, "Prompt text is required and cannot be empty")
    })
    .strict()

const AgentTriggerTemplateSchema = z
    .object({
        id: z.string().optional(),
        config: ConfigTemplateSchema
    })
    .strict()

const AgentOutputTemplateSchema = z
    .object({
        id: z.string().optional(),
        readOnly: z.boolean().optional().default(false),
        config: ConfigTemplateSchema
    })
    .strict()

const AgentTemplateSchema = z
    .object({
        id: z.string().min(1, "Template id is required"),
        category: templateCategorySchema,
        name: z.string().min(1, "Template name is required"),
        description: z.string().min(1, "Template description is required"),
        prompt: AgentPromptSchema,
        triggers: z.array(AgentTriggerTemplateSchema).min(1, "At least one trigger is required"),
        outputs: z.array(AgentOutputTemplateSchema).min(1, "At least one output is required"),
        requireApproval: z.boolean().optional().default(false),
        chatPrompt: z.string().min(1, "Template chatPrompt is required"),
        isActive: z.boolean().optional().default(true),
        notificationSettings: agentNotificationSettingsSchema.optional()
    })
    .strict()

const AgentTemplatesSchema = z.array(AgentTemplateSchema).min(1, "At least one template is required")

type AgentTemplate = z.infer<typeof AgentTemplateSchema>
type ConfigTemplate = z.infer<typeof ConfigTemplateSchema>
export type AgentTemplates = z.infer<typeof AgentTemplatesSchema>

/**
 * Validates templates and throws a detailed error if validation fails.
 * This function should be called at startup to ensure all templates are valid.
 *
 * @param templates - The templates to validate
 * @throws {Error} If validation fails, with detailed error messages
 */
function parseTemplates(templates: unknown): AgentTemplates {
    const result = AgentTemplatesSchema.safeParse(templates)

    if (!result.success) {
        const errors = result.error.issues
        const errorMessages = errors
            .map((error: z.ZodIssue, index: number) => {
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
