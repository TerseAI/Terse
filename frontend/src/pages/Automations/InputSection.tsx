import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, Plus, Settings } from "lucide-react";
import { useIntegrationSelector } from "../../components/IntegrationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { IntegrationTitle } from "./components/IntegrationTitle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FigmaConfig, GmailConfig, NotionConfig, SlackConfig } from "@/shared/types";
import { v4 as uuidv4 } from 'uuid';

export const InputsSection = forwardRef<Map<string, HTMLDivElement>, { ref: React.RefObject<Map<string, HTMLDivElement>> }>((_, ref) => {
    const { inputs, setInputs, isLoading } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const inputRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Expose map of refs keyed by input ID through forwardRef
    useImperativeHandle(ref, () => {
        return inputRefs.current;
    }, [inputs.length]); // Re-run when inputs array length changes

    console.log('Inputs:', inputs);

    const handleSelectPlatform = (integration: Integration) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: Input = { id: newInputId, integration };
        const newInputs: Input[] = [...inputs, newInput];
        setInputs(newInputs);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string, input: Input) => {
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
                <EmptyInputSection onCreateNew={() => setShowAddModal(true)} />
            ) : (
                <InputCardsLayout 
                    inputs={inputs} 
                    handleSelectIntegration={handleSelectIntegration} 
                    setInputs={setInputs} 
                    handleRemove={handleRemove} 
                    setShowAddModal={setShowAddModal}
                    inputRefs={inputRefs}
                />
            )}

            <AddInputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />

        </SectionLayout>
    );
})

function InputCardsLayout({
    inputs, 
    handleSelectIntegration, 
    setInputs, 
    handleRemove, 
    setShowAddModal,
    inputRefs
}: {
    inputs: Input[], 
    handleSelectIntegration: (integrationId: string, input: Input) => void, 
    setInputs: (inputs: Input[]) => void, 
    handleRemove: (id: string) => void, 
    setShowAddModal: (show: boolean) => void,
    inputRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}) {
    return (
        <div className="flex flex-col gap-4">
            {inputs.map((input) => {
                const inputId = input.id || input.integrationId || '';
                return (
                    <InputCard 
                        key={inputId} 
                        input={input} 
                        handleSelectIntegration={handleSelectIntegration} 
                        setInputs={setInputs} 
                        handleRemove={handleRemove}
                        ref={(el) => {
                            if (el) {
                                inputRefs.current.set(inputId, el);
                            } else {
                                inputRefs.current.delete(inputId);
                            }
                        }}
                    />
                );
            })}
            <Button variant="outline" onClick={() => setShowAddModal(true)}>
                Add Event Source
            </Button>
        </div>
    );
}

const InputCard = forwardRef<HTMLDivElement, {
    input: Input, 
    handleSelectIntegration: (integrationId: string, input: Input) => void, 
    setInputs: (inputs: Input[]) => void, 
    handleRemove: (id: string) => void
}>(({
    input,
    handleSelectIntegration,
    setInputs,
    handleRemove
}, ref) => {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    
    const selectorProps = {
        integrationType: input.integration,
        selectedIntegrationId: input.integrationId,
        onSelect: (integrationId: string) => handleSelectIntegration(integrationId, input),
        notionConfig: input.notionConfig,
        onNotionConfigChange: (config: NotionConfig) => {
            if (input) {
                setInputs([{ ...input, notionConfig: config }]);
            }
        },
        slackConfig: input.slackConfig,
        onSlackConfigChange: (config: SlackConfig) => {
            if (input) {
                setInputs([{ ...input, slackConfig: config }]);
            }
        },
        figmaConfig: input.figmaConfig,
        onFigmaConfigChange: (config: FigmaConfig) => {
            if (input) {
                setInputs([{ ...input, figmaConfig: config }]);
            }
        },
        gmailConfig: input.gmailConfig,
        onGmailConfigChange: (config: GmailConfig) => {
            if (input) {
                console.log('Gmail config changed:', config);
                setInputs([{ ...input, gmailConfig: config }]);
            }
        }
    };

    const { CardContent: IntegrationCardContent, DialogContent: IntegrationDialogContent } = useIntegrationSelector(selectorProps);

    return (
        <>
            <Card ref={ref}>
                <CardHeader>
                    <div className="flex justify-between">
                        <IntegrationTitle integration={input.integration} iconSize="md" />
                    </div>
                </CardHeader>

                <CardContent className="min-w-xs">
                    <IntegrationCardContent />
                </CardContent>

                <CardFooter className="justify-between">
                    <Button variant="outline" onClick={() => setShowDetailsDialog(true)}>
                        More Details
                    </Button>
                    <Button variant="destructive" onClick={() => handleRemove(input.id)}>
                        Remove
                    </Button>
                </CardFooter>
            </Card>

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Integration Details</DialogTitle>
                    </DialogHeader>
                    <IntegrationDialogContent />
                </DialogContent>
            </Dialog>
        </>
    );
});

function EmptyInputSection({ onCreateNew }: { onCreateNew: () => void }) {
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
            <EmptyContent>
                <Button
                    variant="outline"
                    onClick={onCreateNew}
                >
                    <Plus className="h-4 w-4" />
                    Add Event Source
                </Button>
            </EmptyContent>
        </Empty>
    );
}
