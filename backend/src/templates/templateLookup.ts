import { AgentTemplate } from "../shared/types"
import { validateTemplates } from "./AgentTemplateSchema"
import templates from "./templates.json" with { type: "json" }

validateTemplates(templates)

const templatesArray = templates as AgentTemplate[]

export function findTemplateById(templateId: string): AgentTemplate | undefined {
    return templatesArray.find(t => t.id === templateId)
}
