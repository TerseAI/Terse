import type { ResendIntegration, ResendTemplate, ToolDefinition } from "terse-types"
import { ApiRoutes, IntegrationType, ToolDefinitions } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { printType } from "../../typePrinter.js"
import { IntegrationModule, type ModuleRenderInput, type ToolParamsPrintOptions } from "../IntegrationModule.js"
import { buildSkillToolType, escapeString, toGeneratedIdentifier } from "../moduleHelpers.js"

export class ResendModule extends IntegrationModule<ResendInstanceData, ResendSectionContext> {
    readonly type = IntegrationType.RESEND
    readonly summaryLabel = "Resend"
    protected readonly sectionImports = ["ResendOutputConfig", "TypedSkill"]

    async fetchInstances(apiKey: string): Promise<ResendInstanceData[]> {
        const instances = await fetchWithAuth<ResendIntegration[]>(ApiRoutes.RESEND.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<ResendInstanceData> => {
                const response = await fetchWithAuth<{ templates: ResendTemplate[] }>(`${ApiRoutes.RESEND.TEMPLATES}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                    templates: []
                }))
                return { id: inst.id, displayName: "Resend", templates: response.templates }
            })
        )
    }

    instanceId(instance: ResendInstanceData): string {
        return instance.id
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Resend — send transactional email using generated published templates */", "    resend: resendSkill,"]
    }

    protected async prepareSection(input: ModuleRenderInput<ResendInstanceData>): Promise<ResendSectionContext> {
        const instance = this.requireInstance(input)
        const usedNames = new Set<string>()
        const templates = instance.templates.map(template => {
            let staticName = toGeneratedIdentifier(template.alias || template.name || "Template", "Template")
            while (usedNames.has(staticName)) staticName += "_"
            usedNames.add(staticName)

            const fields = template.variables.map(variable => {
                const optional = variable.fallbackValue !== null ? "?" : ""
                return `"${escapeString(variable.key)}"${optional}: ${variable.type}`
            })
            const variablesType = fields.length > 0 ? `{ ${fields.join("; ")} }` : "Record<string, never>"
            const variablesMetadata = template.variables
                .map(variable =>
                    JSON.stringify({
                        key: variable.key,
                        type: variable.type,
                        required: variable.fallbackValue === null,
                        fallbackValue: variable.fallbackValue
                    })
                )
                .join(", ")

            return { staticName, id: template.id, alias: template.alias, name: template.name, variablesType, variablesMetadata }
        })

        const baseParamsDeclaration =
            templates.length > 0
                ? await printType({
                      typeName: "ResendSendTemplateBaseParams",
                      schema: ToolDefinitions.resend_send_template.inputSchema,
                      io: "input",
                      omitFields: ["integrationId", "templateId", "variables"]
                  })
                : undefined

        return {
            id: instance.id,
            skillToolType: buildSkillToolType(input.tools),
            baseParamsDeclaration,
            templates
        }
    }

    protected toolParamsPrintOptions(tool: ToolDefinition, input: ModuleRenderInput<ResendInstanceData>): ToolParamsPrintOptions {
        // The Resend section emits ResendSendTemplateParams as a per-template discriminated union
        const hasTemplates = (input.instance?.templates.length ?? 0) > 0
        if (tool.name === "resend_send_template" && hasTemplates) return { suppress: true }
        return {}
    }
}

export interface ResendInstanceData {
    id: string
    displayName: string
    templates: ResendTemplate[]
}

export interface ResendSectionContext {
    id: string
    skillToolType: string
    baseParamsDeclaration?: string
    templates: Array<{
        staticName: string
        id: string
        alias: string | null
        name: string
        variablesType: string
        variablesMetadata: string
    }>
}
