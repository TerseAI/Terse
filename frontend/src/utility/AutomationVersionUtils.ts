import { Integration } from "../types/Integration";
import { AutomationInput, AutomationOutput, AutomationPrompt, AutomationUpdate, AutomationVersion } from "../shared/types";
import { isInputComplete, isOutputComplete } from "./IntegrationUtils";
import isEqual from "fast-deep-equal";

/**
 * Normalized state representation of an automation version for comparison
 * This excludes IDs and only includes complete inputs/outputs
 */
export interface NormalizedAutomationState {
    name: string;
    inputs: Array<{
        integration: string;
        integrationId: string;
        notionConfig?: any;
        slackConfig?: any;
        figmaConfig?: any;
        gmailConfig?: any;
    }>;
    output?: {
        integration: string;
        integrationId: string;
        notionConfig?: any;
        slackConfig?: any;
        notionPageConfig?: any;
        confluenceConfig?: any;
    };
    prompt: string;
}

/**
 * Checks if an automation version is complete (all inputs, output, and prompt are complete)
 */
export function isAutomationVersionComplete(
    inputs: AutomationInput[],
    output: AutomationOutput | undefined,
    prompt: AutomationPrompt | undefined
): boolean {
    return (
        inputs.length > 0 &&
        inputs.every(i => isInputComplete({ ...i, integration: i.integration as Integration })) &&
        !!output && isOutputComplete({ ...output, integration: output.integration as Integration }) &&
        !!prompt?.text
    );
}

/**
 * Normalizes an input for comparison (extracts only relevant fields)
 */
function normalizeInput(input: AutomationInput) {
    return {
        integration: input.integration,
        integrationId: input.integrationId!,
        notionConfig: input.notionConfig,
        slackConfig: input.slackConfig,
        figmaConfig: input.figmaConfig,
        gmailConfig: input.gmailConfig,
    };
}

/**
 * Normalizes an output for comparison (extracts only relevant fields)
 */
function normalizeOutput(output: AutomationOutput) {
    return {
        integration: output.integration,
        integrationId: output.integrationId!,
        notionConfig: output.notionConfig,
        slackConfig: output.slackConfig,
        notionPageConfig: output.notionPageConfig,
        confluenceConfig: output.confluenceConfig,
    };
}

/**
 * Normalizes an automation version for comparison by:
 * - Removing IDs (which are backend-generated and change on save)
 * - Only including complete inputs/outputs
 * - Extracting just the essential data for comparison
 */
export function normalizeAutomationVersionForComparison(
    inputs: AutomationInput[],
    output: AutomationOutput | undefined,
    prompt: AutomationPrompt | undefined,
    name?: string | null,
    defaultName?: string | null
): NormalizedAutomationState {
    const completeInputs = inputs
        .filter(i => isInputComplete({ ...i, integration: i.integration as Integration }))
        .map(normalizeInput);

    const completeOutput = output && isOutputComplete({ ...output, integration: output.integration as Integration })
        ? normalizeOutput(output)
        : undefined;

    return {
        name: name || defaultName || '',
        inputs: completeInputs,
        output: completeOutput,
        prompt: prompt?.text || '',
    };
}

/**
 * Normalizes an AutomationVersion object for comparison
 * Note: Name is not included in version comparison as it's at the automation level, not version level
 */
export function normalizeAutomationVersion(
    version: AutomationVersion
): NormalizedAutomationState {
    const inputs = (version.inputs || [])
        .filter(i => isInputComplete({ ...i, integration: i.integration as Integration }))
        .map(normalizeInput);

    const output = version.output && isOutputComplete({ ...version.output, integration: version.output.integration as Integration })
        ? normalizeOutput(version.output)
        : undefined;

    return {
        name: '', // Name is not part of version comparison
        inputs,
        output,
        prompt: version.prompt?.text || '',
    };
}

/**
 * Checks if a draft version has changes compared to a production version
 * Returns true if there are changes, false if they are the same
 * If no production version exists, returns true if the draft has any content
 * Note: Name is not compared as it's at the automation level, not version level
 */
export function hasChangesFromProduction(
    draftInputs: AutomationInput[],
    draftOutput: AutomationOutput | undefined,
    draftPrompt: AutomationPrompt | undefined,
    draftName: string | null | undefined,
    defaultName: string | null | undefined,
    productionVersion: AutomationVersion | undefined
): boolean {
    // If no production version, check if draft has any content
    if (!productionVersion) {
        return draftInputs.length > 0 || !!draftOutput || !!draftPrompt?.text;
    }

    // Normalize both versions for comparison (name is excluded from comparison)
    const draftState = normalizeAutomationVersionForComparison(
        draftInputs,
        draftOutput,
        draftPrompt,
        draftName,
        defaultName
    );
    
    const productionState = normalizeAutomationVersion(productionVersion);

    // Compare the normalized states (excluding name)
    return !isEqual(
        { ...draftState, name: '' },
        productionState
    );
}

/**
 * Creates an AutomationUpdate payload from automation state
 * Only includes complete inputs and outputs, filtering out incomplete items
 */
export function createAutomationUpdatePayload(
    inputs: AutomationInput[],
    output: AutomationOutput | undefined,
    prompt: AutomationPrompt | undefined,
    name?: string | null,
    defaultName?: string | null,
    isActive?: boolean
): AutomationUpdate {
    // Filter out incomplete inputs and outputs before saving - only send items that are fully configured
    const completeInputs = inputs.filter(i => 
        isInputComplete({ ...i, integration: i.integration as Integration })
    );
    const completeOutput = output && isOutputComplete({ ...output, integration: output.integration as Integration }) 
        ? output 
        : undefined;

    return {
        name: name || defaultName || '',
        inputs: completeInputs.map(i => {
            const inputData: any = {
                integration: i.integration,
                integrationId: i.integrationId,
            };
            
            // Only include configs that exist
            if (i.notionConfig) inputData.notionConfig = i.notionConfig;
            if (i.slackConfig) inputData.slackConfig = i.slackConfig;
            if (i.gmailConfig) inputData.gmailConfig = i.gmailConfig;
            // Only include figmaConfig if it has required fields
            if (i.figmaConfig?.fileKey && i.figmaConfig?.teamId) {
                inputData.figmaConfig = i.figmaConfig;
            }
            
            return inputData;
        }),
        output: completeOutput ? {
            integration: completeOutput.integration,
            integrationId: completeOutput.integrationId,
            ...(completeOutput.notionConfig && { notionConfig: completeOutput.notionConfig }),
            ...(completeOutput.slackConfig && { slackConfig: completeOutput.slackConfig }),
            ...(completeOutput.notionPageConfig && { notionPageConfig: completeOutput.notionPageConfig }),
            ...(completeOutput.confluenceConfig && { confluenceConfig: completeOutput.confluenceConfig })
        } : undefined,
        prompt,
        isActive,
    };
}

