import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { AutomationVersion } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAutomationName } from "@/utility/AutomationUtils";
import { useAutomationCount } from "@/hooks/api/useAutomationCount";
import { Integration } from "@/types/Integration";
import { isAutomationVersionComplete, hasChangesFromProduction, createAutomationUpdatePayload } from "@/utility/AutomationVersionUtils";
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

function PublishButton({ 
    defaultName, 
    automationId, 
    name, 
    inputs, 
    output, 
    prompt, 
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
    mutate: KeyedMutator<Automation>;
    productionVersion?: AutomationVersion;
    onPublishSuccess?: () => void;
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isPublishing, setIsPublishing] = useState(false);
    const { publishAutomation } = useAutomationMutations();

    // Validation: all required fields must be present and complete
    const isComplete = isAutomationVersionComplete(inputs, output, prompt);

    // Check if draft has changes from production version
    const hasChanges = useMemo(() => {
        return hasChangesFromProduction(
            inputs,
            output,
            prompt,
            name,
            defaultName,
            productionVersion
        );
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
            disabled={!hasChanges || isPublishing}
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
    const lastSavedPayloadRef = useRef<string | null>(null);

    // Create the actual API payload and serialize it for comparison
    const currentPayloadString = useMemo(() => {
        if (!automationId) return null;
        const payload = createAutomationUpdatePayload(
            inputs,
            output,
            prompt,
            name,
            defaultName,
            isActive
        );
        return JSON.stringify(payload);
    }, [automationId, name, defaultName, inputs, output, prompt, isActive]);

    // Track the current automationId to detect changes
    const previousAutomationIdRef = useRef<string | null>(null);

    // Reset saved payload when automationId changes, or initialize when data first loads
    useEffect(() => {
        // Reset if automationId changed
        if (automationId !== previousAutomationIdRef.current) {
            previousAutomationIdRef.current = automationId;
            lastSavedPayloadRef.current = null;
        }

        // Initialize once when data is loaded (only if not already initialized)
        if (!isLoading && automationId && currentPayloadString && lastSavedPayloadRef.current === null) {
            console.log('[AutoSave] Initializing saved payload:', {
                automationId,
                payloadLength: currentPayloadString.length
            });
            lastSavedPayloadRef.current = currentPayloadString;
        }
    }, [automationId, isLoading, currentPayloadString]);

    // Progressive saving with debounce - only when payload actually changes
    useEffect(() => {
        if (!automationId || isLoading || !currentPayloadString || lastSavedPayloadRef.current === null) {
            return;
        }
        
        if (currentPayloadString === lastSavedPayloadRef.current) {
            return;
        }

        // Capture the payload string at the moment we decide to save
        const payloadToSave = currentPayloadString;

        const timeoutId = setTimeout(async () => {
            // Mark this payload as saved BEFORE making the API call
            // This prevents the refetch from triggering another save
            lastSavedPayloadRef.current = payloadToSave;
            setIsSaving(true);
            
            try {
                const automationData = createAutomationUpdatePayload(
                    inputs,
                    output,
                    prompt,
                    name,
                    defaultName,
                    isActive
                );

                // Skip cache updates during autosave to prevent re-renders that close modals
                await updateAutomation({
                    id: automationId,
                    data: automationData,
                    skipCacheUpdate: true,
                });
            } catch (error) {
                // On error, reset the saved payload so we can retry
                lastSavedPayloadRef.current = null;
                console.error('[AutoSave] Error saving draft:', error);
            } finally {
                setIsSaving(false);
            }
        }, 500); // 500ms debounce

        return () => {
            clearTimeout(timeoutId);
        };
    }, [currentPayloadString, automationId, name, defaultName, inputs, output, prompt, isActive, isLoading, updateAutomation]);

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
