import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { Integration } from "@/types/Integration";
import { AutomationInput } from "../../shared/types";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, Plus, Settings, AlertTriangle } from "lucide-react";
import { IntegrationSelector, useIntegrationSelector } from "../../components/IntegrationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { IntegrationTitle } from "./components/IntegrationTitle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FigmaConfig, GmailConfig, NotionConfig, SlackConfig } from "@/shared/types";
import { isInputComplete } from "../../utility/IntegrationUtils";
import { v4 as uuidv4 } from 'uuid';

type InputsSectionProps = {
    inputs: AutomationInput[];
    setInputs: (inputs: AutomationInput[]) => void;
    isLoading: boolean;
    readonly?: boolean;
};

export const InputsSection = forwardRef<Map<string, HTMLDivElement>, InputsSectionProps>(({ inputs, setInputs, isLoading, readonly = false }, ref) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const inputRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(ref, () => {
        return inputRefs.current;
    }, [inputs]);

    const handleSelectPlatform = (integration: Integration) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: AutomationInput = { id: newInputId, integration: integration as string };
        const newInputs: AutomationInput[] = [...inputs, newInput];
        setInputs(newInputs);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string, input: AutomationInput) => {
        // Check if we have a matching input already in inputs
        const matchingInput = inputs.find(i => i.id === input.id);
        if (matchingInput) {
            // Update the matching input with the new integrationId. Keep other existing inputs unchanged.
            setInputs(inputs.map(i => i.id === matchingInput.id ? { ...i, integrationId } : i));
        }
    };

    const handleRemove = (id: string) => {
        setInputs(inputs.filter(input => input.id !== id));
    };

    return (
        <SectionLayout
            subtitle="Choose which integration triggers this automation"
            icon={<Zap className="w-5 h-5 text-primary" />}
            isLoading={isLoading}
        >
            {!inputs.length ? (
                <EmptyInputSection onCreateNew={() => !readonly && setShowAddModal(true)} readonly={readonly} />
            ) : (
                <InputCardsLayout 
                    inputs={inputs} 
                    handleSelectIntegration={handleSelectIntegration} 
                    setInputs={setInputs} 
                    handleRemove={handleRemove} 
                    setShowAddModal={setShowAddModal}
                    inputRefs={inputRefs}
                    readonly={readonly}
                />
            )}

            {!readonly && (
                <AddInputModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectIntegration={handleSelectPlatform}
                />
            )}

        </SectionLayout>
    );
})

function InputCardsLayout({
    inputs, 
    handleSelectIntegration, 
    setInputs, 
    handleRemove, 
    setShowAddModal,
    inputRefs,
    readonly
}: {
    inputs: AutomationInput[], 
    handleSelectIntegration: (integrationId: string, input: AutomationInput) => void, 
    setInputs: (inputs: AutomationInput[]) => void, 
    handleRemove: (id: string) => void, 
    setShowAddModal: (show: boolean) => void,
    inputRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
    readonly: boolean
}) {
    const isSingleInput = inputs.length === 1;
    
    if (isSingleInput) {
        return (
            <div className="relative w-full">
                <div className="flex justify-center">
                    {inputs.map((input) => {
                        const inputId = input.id || input.integrationId || '';
                        return (
                            <InputCard 
                                key={inputId} 
                                input={input} 
                                inputs={inputs}
                                handleSelectIntegration={handleSelectIntegration} 
                                setInputs={setInputs} 
                                handleRemove={handleRemove}
                                ref={(el) => {
                                    if (el && isInputComplete({ ...input, integration: input.integration as Integration })) {
                                        inputRefs.current.set(inputId, el);
                                    } else {
                                        inputRefs.current.delete(inputId);
                                    }
                                }}
                            />
                        );
                    })}
                </div>
                {!readonly && (
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                        <Button variant="outline" onClick={() => setShowAddModal(true)} className="min-w-xs">
                            Add Event Source
                        </Button>
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-4">
            {inputs.map((input) => {
                const inputId = input.id || input.integrationId || '';
                return (
                    <InputCard 
                        key={inputId} 
                        input={input} 
                        inputs={inputs}
                        handleSelectIntegration={handleSelectIntegration} 
                        setInputs={setInputs} 
                        handleRemove={handleRemove}
                        readonly={readonly}
                        ref={(el) => {
                            if (el && isInputComplete({ ...input, integration: input.integration as Integration })) {
                                inputRefs.current.set(inputId, el);
                            } else {
                                inputRefs.current.delete(inputId);
                            }
                        }}
                    />
                );
            })}
            {!readonly && (
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="min-w-xs">
                    Add Event Source
                </Button>
            )}
        </div>
    );
}

const InputCard = forwardRef<HTMLDivElement, {
    input: AutomationInput,
    inputs: AutomationInput[],
    handleSelectIntegration: (integrationId: string, input: AutomationInput) => void, 
    setInputs: (inputs: AutomationInput[]) => void, 
    handleRemove: (id: string) => void,
    readonly?: boolean
}>(({
    input,
    inputs,
    handleSelectIntegration,
    setInputs,
    handleRemove,
    readonly = false
}, ref) => {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    
    const selectorProps = {
        integrationType: input.integration as Integration,
        selectedIntegrationId: input.integrationId,
        onSelect: readonly ? undefined : (integrationId: string) => handleSelectIntegration(integrationId, input),
        notionConfig: input.notionConfig,
        onNotionConfigChange: readonly ? undefined : (config: NotionConfig) => {
            setInputs(inputs.map(i => i.id === input.id ? { ...i, notionConfig: config } : i));
        },
        slackConfig: input.slackConfig,
        onSlackConfigChange: readonly ? undefined : (config: SlackConfig) => {
            setInputs(inputs.map(i => i.id === input.id ? { ...i, slackConfig: config } : i));
        },
        figmaConfig: input.figmaConfig,
        onFigmaConfigChange: readonly ? undefined : (config: FigmaConfig) => {
            setInputs(inputs.map(i => i.id === input.id ? { ...i, figmaConfig: config } : i));
        },
        gmailConfig: input.gmailConfig,
        onGmailConfigChange: readonly ? undefined : (config: GmailConfig) => {
            console.log('Gmail config changed:', config);
            setInputs(inputs.map(i => i.id === input.id ? { ...i, gmailConfig: config } : i));
        },
        readonly
    };

    const { isConfigurationIncomplete } = useIntegrationSelector(selectorProps);
    
    const needsConfiguration = isConfigurationIncomplete();

    return (
        <>
            <Card ref={ref}>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <IntegrationTitle integration={input.integration as Integration} iconSize="md" />
                        {needsConfiguration && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                                <AlertTriangle className="w-3 h-3" />
                                Needs Configuration
                            </Badge>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="min-w-xs">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </CardContent>

                {!readonly && (
                    <CardFooter className="justify-between">
                        <Button 
                            variant="outline"
                            className={needsConfiguration ? "border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 dark:text-yellow-500 dark:hover:bg-yellow-950/20 dark:hover:text-yellow-400" : ""}
                            onClick={() => setShowDetailsDialog(true)}
                        >
                            {needsConfiguration ? "Configure" : "More Details"}
                        </Button>
                        <Button variant="destructive" onClick={() => handleRemove(input.id)}>
                            Remove
                        </Button>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Integration" : "Integration Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
                </DialogContent>
            </Dialog>
        </>
    );
});

function EmptyInputSection({ onCreateNew, readonly }: { onCreateNew: () => void; readonly?: boolean }) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Settings className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No event source yet</EmptyTitle>
                <EmptyDescription>
                    No event source yet. Add an integration to get started.
                </EmptyDescription>
            </EmptyHeader>
            {!readonly && (
                <EmptyContent>
                    <Button
                        variant="outline"
                        onClick={onCreateNew}
                    >
                        <Plus className="h-4 w-4" />
                        Add Event Source
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
}
