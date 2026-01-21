import { v4 as uuidv4 } from "uuid";
import { ChannelTemplate } from "../hooks/api/useTemplates";
import { ChannelNotificationSettings, ChannelPrompt, TemplateInput, TemplateOutput, TemplateKnowledgeBase, TransientChannelInput, TransientChannelOutput, TransientKnowledgeBase } from "../shared/types";
import { ConfigType } from "../shared/Configs";

export interface HydratedTemplateState {
    name: string | null;
    prompt: ChannelPrompt | undefined;
    isActive: boolean;
    inputs: TransientChannelInput[];
    outputs: TransientChannelOutput[];
    knowledgeBases: TransientKnowledgeBase[];
    notificationSettings: ChannelNotificationSettings;
}

export function useTemplateHydration(
    templateId: string | undefined,
    templates: ChannelTemplate[]
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
    const transientInputs: TransientChannelInput[] = template.inputs.map((input: TemplateInput) => ({
        id: uuidv4(),
        configType: input.config.configType as ConfigType,
        config: undefined, // User needs to select integration
    }));

    // Convert template outputs to transient outputs
    const transientOutputs: TransientChannelOutput[] = template.outputs && template.outputs.length > 0
        ? template.outputs.map((output: TemplateOutput) => ({
              id: uuidv4(),
              configType: output.config.configType as ConfigType,
              config: undefined, // User needs to select integration
          }))
        : [];

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
    const notificationSettings: ChannelNotificationSettings = { enabled: false, actionTypes: [] };

    return {
        hydratedState: {
            name: template.name,
            prompt: template.prompt,
            isActive: template.isActive,
            inputs: transientInputs,
            outputs: transientOutputs,
            knowledgeBases: transientKBs,
            notificationSettings,
        },
        templateFound: true,
    };
}

