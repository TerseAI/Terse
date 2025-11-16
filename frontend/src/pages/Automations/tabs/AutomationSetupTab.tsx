import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { AutomationUpdate, AutomationVersion } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAutomationName } from "@/utility/AutomationUtils";
import { useAutomationCount } from "@/hooks/api/useAutomationCount";
import { isInputComplete, isOutputComplete } from "@/utility/IntegrationUtils";
import { Integration } from "@/types/Integration";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";
import { useAutomationMutations } from "@/hooks/api/useAutomations";
import { type KeyedMutator } from 'swr';
import { Automation, AutomationInput, AutomationOutput, AutomationPrompt } from "@/shared/types";

type AutomationSetupTabProps = {
    automationId: string | null;
    name: string | null;
    setName: (name: string) => void;
    inputs: AutomationInput[];
    setInputs: (inputs: AutomationInput[]) => void;
    output: AutomationOutput | undefined;
    setOutput: (output: AutomationOutput | undefined) => void;
    prompt: AutomationPrompt | undefined;
    setPrompt: (prompt: AutomationPrompt | undefined) => void;
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    isLoading: boolean;
    mutate: KeyedMutator<Automation>;
    productionVersion?: AutomationVersion;
    onPublishSuccess?: () => void;
};

// Helper function to deep compare two objects
function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
}

function PublishButton({ 
    defaultName, 
    automationId, 
    name, 
    inputs, 
    output, 
    prompt, 
    isActive,
    mutate,
    productionVersion,
    onPublishSuccess
}: { 
    defaultName: string;
    automationId: string | null;
    name: string | null;
    inputs: AutomationInput[];
    output: AutomationOutput | undefined;
    prompt: AutomationPrompt | undefined;
    isActive: boolean;
    mutate: KeyedMutator<Automation>;
    productionVersion?: AutomationVersion;
    onPublishSuccess?: () => void;
}) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isPublishing, setIsPublishing] = useState(false);
    const { publishAutomation } = useAutomationMutations();

    // Validation: all required fields must be present
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => isInputComplete({ ...i, integration: i.integration as Integration })) &&
        !!output && isOutputComplete({ ...output, integration: output.integration as Integration }) &&
        !!prompt?.text;

    // Check if draft has changes from production version
    const hasChanges = useMemo(() => {
        if (!productionVersion) {
            // If no production version, check if draft has any content
            return inputs.length > 0 || !!output || !!prompt?.text;
        }

        // Compare current draft state with production version
        const currentState = {
            name: name || defaultName || '',
            inputs: inputs.map(i => ({
                integration: i.integration,
                integrationId: i.integrationId,
                notionConfig: i.notionConfig,
                slackConfig: i.slackConfig,
                figmaConfig: i.figmaConfig,
                gmailConfig: i.gmailConfig,
            })),
            output: output ? {
                integration: output.integration,
                integrationId: output.integrationId,
                notionConfig: output.notionConfig,
                slackConfig: output.slackConfig,
                notionPageConfig: output.notionPageConfig,
                confluenceConfig: output.confluenceConfig,
            } : undefined,
            prompt: prompt?.text || '',
        };

        const productionState = {
            name: productionVersion.prompt ? 'Production Automation' : 'Production Automation', // Production doesn't have name in version
            inputs: (productionVersion.inputs || []).map(i => ({
                integration: i.integration,
                integrationId: i.integrationId,
                notionConfig: i.notionConfig,
                slackConfig: i.slackConfig,
                figmaConfig: i.figmaConfig,
                gmailConfig: i.gmailConfig,
            })),
            output: productionVersion.output ? {
                integration: productionVersion.output.integration,
                integrationId: productionVersion.output.integrationId,
                notionConfig: productionVersion.output.notionConfig,
                slackConfig: productionVersion.output.slackConfig,
                notionPageConfig: productionVersion.output.notionPageConfig,
                confluenceConfig: productionVersion.output.confluenceConfig,
            } : undefined,
            prompt: productionVersion.prompt?.text || '',
        };

        return !deepEqual(currentState, productionState);
    }, [name, defaultName, inputs, output, prompt, productionVersion]);

    const handlePublish = async () => {
        if (!isComplete || !automationId || !inputs.length || !output) return;

        setIsPublishing(true);
        try {
            await publishAutomation(automationId, mutate);
            toast.success('Automation published successfully');
            
            if (onPublishSuccess) {
                onPublishSuccess();
            } else {
                // Switch to production tab by updating URL
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('tab', 'production');
                setSearchParams(nextParams, { replace: true });
            }
        } catch (error) {
            console.error('Error publishing automation:', error);
            toast.error('Failed to publish automation. Please try again.');
        } finally {
            setIsPublishing(false);
        }
    };

    if (!automationId) {
        return null; // Don't show publish button for new automations
    }

    return (
        <Button
            onClick={handlePublish}
            disabled={!isComplete || !hasChanges || isPublishing}
        >
            {isPublishing ? 'Publishing...' : 'Publish'}
        </Button>
    );
}

export default function AutomationSetupTab({
    automationId,
    name,
    setName,
    inputs,
    output,
    prompt,
    setInputs,
    setOutput,
    setPrompt,
    isActive,
    isLoading,
    mutate,
    productionVersion,
    onPublishSuccess,
}: AutomationSetupTabProps) {
    const { totalCount } = useAutomationCount();
    const defaultName = getDefaultAutomationName(
        inputs.map(i => ({ integration: i.integration as Integration })),
        output ? { integration: output.integration as Integration } : undefined,
        totalCount
    );

    const { updateAutomation } = useAutomationMutations();
    const [isSaving, setIsSaving] = useState(false);
    const lastSavedStateRef = useRef<string | null>(null);
    const hasInitializedRef = useRef(false);
    const lastAutomationIdRef = useRef<string | null>(null);

    // Create a serialized state for comparison (only user-editable fields, not computed values)
    const currentStateString = useMemo(() => {
        // Only serialize the actual user-editable state, not computed values like defaultName
        // NOTE: We don't include IDs in the comparison since they're backend-generated and change on save
        const state = {
            name: name || '', // Use name directly, not defaultName
            inputs: inputs.map(i => ({
                // Don't include id - it's backend-generated and changes on each save
                integration: i.integration,
                integrationId: i.integrationId,
                notionConfig: i.notionConfig,
                slackConfig: i.slackConfig,
                figmaConfig: i.figmaConfig,
                gmailConfig: i.gmailConfig,
            })),
            output: output ? {
                integration: output.integration,
                integrationId: output.integrationId,
                notionConfig: output.notionConfig,
                slackConfig: output.slackConfig,
                notionPageConfig: output.notionPageConfig,
                confluenceConfig: output.confluenceConfig,
            } : undefined,
            prompt: prompt?.text || '',
        };
        const serialized = JSON.stringify(state);
        console.log('[AutoSave] currentStateString recalculated:', {
            name,
            inputsCount: inputs.length,
            hasOutput: !!output,
            promptText: prompt?.text?.substring(0, 50),
            serializedLength: serialized.length,
            serializedHash: serialized.substring(0, 50) + '...'
        });
        return serialized;
    }, [name, inputs, output, prompt]);

    // Initialize lastSavedState when data first loads (only once per automation)
    useEffect(() => {
        // Reset if automationId changed
        if (automationId !== lastAutomationIdRef.current) {
            console.log('[AutoSave] Automation ID changed:', {
                old: lastAutomationIdRef.current,
                new: automationId
            });
            lastAutomationIdRef.current = automationId;
            hasInitializedRef.current = false;
            lastSavedStateRef.current = null;
        }

        // Initialize once when data is loaded
        if (!isLoading && automationId && currentStateString && !hasInitializedRef.current) {
            console.log('[AutoSave] Initializing saved state:', {
                automationId,
                stateLength: currentStateString.length,
                stateHash: currentStateString.substring(0, 50) + '...'
            });
            lastSavedStateRef.current = currentStateString;
            hasInitializedRef.current = true;
        }
    }, [isLoading, automationId, currentStateString]);

    // Progressive saving with debounce - only when state actually changes
    useEffect(() => {
        console.log('[AutoSave] Effect triggered:', {
            automationId,
            isLoading,
            hasInitialized: hasInitializedRef.current,
            currentStateLength: currentStateString?.length,
            lastSavedStateLength: lastSavedStateRef.current?.length,
            statesMatch: currentStateString === lastSavedStateRef.current,
            currentStateHash: currentStateString?.substring(0, 50) + '...',
            lastSavedStateHash: lastSavedStateRef.current?.substring(0, 50) + '...'
        });

        if (!automationId || isLoading || !hasInitializedRef.current) {
            console.log('[AutoSave] Skipping save - conditions not met');
            return;
        }
        
        if (currentStateString === lastSavedStateRef.current) {
            console.log('[AutoSave] Skipping save - states match');
            return;
        }

        // Capture the state string at the moment we decide to save
        const stateToSave = currentStateString;
        console.log('[AutoSave] Scheduling save:', {
            stateToSaveLength: stateToSave.length,
            stateToSaveHash: stateToSave.substring(0, 50) + '...',
            debounceMs: 500
        });

        const timeoutId = setTimeout(async () => {
            console.log('[AutoSave] Executing save:', {
                stateToSaveLength: stateToSave.length,
                currentStateLength: currentStateString.length,
                statesStillMatch: currentStateString === stateToSave
            });

            // Mark this state as saved BEFORE making the API call
            // This prevents the refetch from triggering another save
            // We do this early to prevent race conditions
            lastSavedStateRef.current = stateToSave;
            console.log('[AutoSave] Updated lastSavedStateRef before API call');
            setIsSaving(true);
            
            try {
                const automationData: AutomationUpdate = {
                    name: name || defaultName || '',
                    inputs: inputs.map(i => {
                        const inputData: any = {
                            integration: i.integration,
                            integrationId: i.integrationId,
                        };
                        
                        if (i.notionConfig) {
                            inputData.notionConfig = i.notionConfig;
                        }
                        if (i.slackConfig) {
                            inputData.slackConfig = i.slackConfig;
                        }
                        if (i.figmaConfig) {
                            if (i.figmaConfig.fileKey && i.figmaConfig.teamId) {
                                inputData.figmaConfig = i.figmaConfig;
                            }
                        }
                        if (i.gmailConfig) {
                            inputData.gmailConfig = i.gmailConfig;
                        }
                        
                        return inputData;
                    }),
                    output: output ? {
                        integration: output.integration,
                        integrationId: output.integrationId,
                        ...(output.notionConfig && { notionConfig: output.notionConfig }),
                        ...(output.slackConfig && { slackConfig: output.slackConfig }),
                        ...(output.notionPageConfig && { notionPageConfig: output.notionPageConfig }),
                        ...(output.confluenceConfig && { confluenceConfig: output.confluenceConfig })
                    } : undefined,
                    prompt,
                    isActive
                };

                console.log('[AutoSave] Calling updateAutomation API');
                await updateAutomation({
                    id: automationId,
                    data: automationData,
                    mutateAutomation: mutate,
                });
                console.log('[AutoSave] Save completed successfully');
            } catch (error) {
                // On error, reset the saved state so we can retry
                lastSavedStateRef.current = null;
                console.error('[AutoSave] Error saving draft:', error);
                // Don't show error toast for auto-save failures to avoid noise
            } finally {
                setIsSaving(false);
                console.log('[AutoSave] Save process finished, isSaving set to false');
            }
        }, 500); // 500ms debounce

        return () => {
            console.log('[AutoSave] Cleaning up timeout');
            clearTimeout(timeoutId);
        };
    }, [currentStateString, automationId, name, defaultName, inputs, output, prompt, isActive, isLoading, mutate, updateAutomation]);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputsSectionRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const PromptSectionRef = useRef<HTMLDivElement>(null);
    const OutputSectionRef = useRef<HTMLDivElement>(null);

    const createMapElementRef = (mapRef: React.RefObject<Map<string, HTMLDivElement>>, inputId: string): React.RefObject<HTMLDivElement | null> => {
        return {
            get current() {
                return mapRef.current?.get(inputId) || null;
            }
        } as React.RefObject<HTMLDivElement | null>;
    };

    const connections: Conn[] = []
    
    if (inputs.length > 0 && inputsSectionRef.current != null && inputsSectionRef.current.size > 0) {
        inputs.forEach((input) => {
            if (input.integration != null && input.integrationId != null) {
                const inputId = input.id || input.integrationId || '';
                const inputCardRef = createMapElementRef(inputsSectionRef, inputId);
                connections.push({ 
                    id: `input-to-prompt-${input.integration}-${input.integrationId}`, 
                    from: inputCardRef, 
                    to: PromptSectionRef 
                });
            }
        });
    }
    if (prompt != null && PromptSectionRef.current != null && OutputSectionRef.current != null && output != null) {
        connections.push({ id: 'prompt-to-output', from: PromptSectionRef, to: OutputSectionRef });
    }

    return (
        <div className="flex flex-col h-full p-4 overflow-y-auto gap-6">
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-2">
                    <EditableTextField value={name || defaultName || ''} onSave={(value) => setName(value)} />
                    {isSaving && (
                        <span className="text-xs text-muted-foreground">Saving...</span>
                    )}
                </div>
                {automationId && (
                    <PublishButton 
                        defaultName={defaultName}
                        automationId={automationId}
                        name={name}
                        inputs={inputs}
                        output={output}
                        prompt={prompt}
                        isActive={isActive}
                        mutate={mutate}
                        productionVersion={productionVersion}
                        onPublishSuccess={onPublishSuccess}
                    />
                )}
            </div>

            <div ref={containerRef} className="grid grid-flow-col place-items-center gap-3 relative">
                <InputsSection ref={inputsSectionRef} inputs={inputs} setInputs={setInputs} isLoading={isLoading} />

                <PromptSection ref={PromptSectionRef} prompt={prompt} setPrompt={setPrompt} />

                <OutputSection ref={OutputSectionRef} output={output} setOutput={setOutput} isLoading={isLoading} />

                {connections.length > 0 && (
                    <SVGFlowArrows containerRef={containerRef} connections={connections} />
                )}
            </div>
        </div>
    );
}
