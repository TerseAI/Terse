import { v4 as uuidv4 } from "uuid";
import { AgentTemplate } from "../hooks/api/useTemplates";
import { AgentNotificationSettings, AgentPrompt, TemplateInput, TemplateKnowledgeBase, TransientAgentInput, TransientAgentOutput, TransientKnowledgeBase } from "../shared/types";
import { ConfigType } from "../shared/Configs";

export interface HydratedTemplateState {
    name: string | null;
    prompt: AgentPrompt | undefined;
    isActive: boolean;
    requireApproval: boolean;
    inputs: TransientAgentInput[];
    output: TransientAgentOutput | undefined;
    knowledgeBases: TransientKnowledgeBase[];
    notificationSettings: AgentNotificationSettings;
}

export function useTemplateHydration(
    templateId: string | undefined,
    templates: AgentTemplate[]
): { hydratedState: HydratedTemplateState | null; templateFound: boolean } {
    if (!templateId || templates.length === 0) {
        return {
            hydratedState: null,
            templateFound: false,
        };
    }

    const templateIndex = parseInt(templateId, 10);
    const template = templates[templateIndex];

    if (!template) {
        return {
            hydratedState: null,
            templateFound: false,
        };
    }

    // Convert template inputs to transient inputs (config will be undefined, user needs to configure)
    const transientInputs: TransientAgentInput[] = template.inputs.map((input: TemplateInput) => ({
        id: uuidv4(),
        configType: input.config.configType as ConfigType,
        config: undefined, // User needs to select integration
    }));

    // Convert template output to transient output
    const transientOutput: TransientAgentOutput | undefined = template.output
        ? {
              id: uuidv4(),
              configType: template.output.config.configType as ConfigType,
              config: undefined, // User needs to select integration
          }
        : undefined;

    // Convert template knowledge bases to transient knowledge bases
    const transientKBs: TransientKnowledgeBase[] =
        template.knowledgeBases && template.knowledgeBases.length > 0
            ? template.knowledgeBases.map((kb: TemplateKnowledgeBase) => ({
                  id: uuidv4(),
                  configType: kb.config.configType as ConfigType,
                  config: undefined, // User needs to select integration
              }))
            : [];

    // Handle notification settings from template
    const notificationSettings: AgentNotificationSettings = { enabled: false, actionTypes: [] };

    return {
        hydratedState: {
            name: template.name,
            prompt: template.prompt,
            isActive: template.isActive,
            requireApproval: template.requireApproval,
            inputs: transientInputs,
            output: transientOutput,
            knowledgeBases: transientKBs,
            notificationSettings,
        },
        templateFound: true,
    };
}

