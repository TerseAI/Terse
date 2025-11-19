import { forwardRef, useState, useImperativeHandle, useRef } from "react";
import { TransientAutomationInput } from "../../shared/types";
import { ConfigInstance, ConfigType } from "@/shared/Configs";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, Plus, Settings, AlertTriangle } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { v4 as uuidv4 } from 'uuid';
import { InputConfigSelectorProps } from "@/components/IntegrationSelector/types";
import { ConfigTitle } from "./components/ConfigTitle";

type InputsSectionProps = {
    inputs: TransientAutomationInput[];
    setInputs: (inputs: TransientAutomationInput[]) => void;
    isLoading: boolean;
};

export const InputsSection = forwardRef<Map<string, HTMLDivElement>, InputsSectionProps>(({ inputs, setInputs, isLoading }, ref) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const inputRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(ref, () => {
        return inputRefs.current;
    }, [inputs]);

    const handleSelectPlatform = (config: ConfigType) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: TransientAutomationInput = { id: newInputId, config: undefined, configType: config };
        const newInputs: TransientAutomationInput[] = [...inputs, newInput];
        setInputs(newInputs);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string, input: TransientAutomationInput) => {
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
    setInputs, 
    handleRemove, 
    setShowAddModal,
    inputRefs
}: {
    inputs: TransientAutomationInput[], 
    handleSelectIntegration: (integrationId: string, input: TransientAutomationInput) => void, 
    setInputs: (inputs: TransientAutomationInput[]) => void, 
    handleRemove: (id: string) => void, 
    setShowAddModal: (show: boolean) => void,
    inputRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}) {
    const isSingleInput = inputs.length === 1;
    
    if (isSingleInput) {
        return (
            <div className="relative w-full h-full">
                <div className="flex justify-center">
                    {inputs.map((input) => {
                        return (
                            <InputCard 
                                key={input.id} 
                                input={input} 
                                inputs={inputs}
                                setInputs={setInputs} 
                                handleRemove={handleRemove}
                                ref={(el) => {
                                    if (el && input.config?.isComplete()) {
                                        inputRefs.current.set(input.id, el);
                                    } else {
                                        inputRefs.current.delete(input.id);
                                    }
                                }}
                            />
                        );
                    })}
                </div>
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <Button variant="outline" onClick={() => setShowAddModal(true)} className="min-w-xs">
                        Add Event Source
                    </Button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-4">
            {inputs.map((input) => {
                return (
                    <InputCard 
                        key={input.id} 
                        input={input} 
                        inputs={inputs}
                        setInputs={setInputs} 
                        handleRemove={handleRemove}
                        ref={(el) => {
                            if (el && input.config?.isComplete()) {
                                inputRefs.current.set(input.id, el);
                            } else {
                                inputRefs.current.delete(input.id);
                            }
                        }}
                    />
                );
            })}
            <Button variant="outline" onClick={() => setShowAddModal(true)} className="min-w-xs">
                Add Event Source
            </Button>
        </div>
    );
}

const InputCard = forwardRef<HTMLDivElement, {
    input: TransientAutomationInput,
    inputs: TransientAutomationInput[],
    setInputs: (inputs: TransientAutomationInput[]) => void, 
    handleRemove: (id: string) => void
}>(({
    input,
    inputs,
    setInputs,
    handleRemove
}, ref) => {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    const selectorProps: InputConfigSelectorProps = {
        input: input,
        setConfig: (config: ConfigInstance) => setInputs(inputs.map(i => i.id === input.id ? { ...i, config, configType: config.configType } : i)),
        variant: "card"
    };
    // Input needs configuration if there's no config OR if the config is not complete
    const needsConfiguration = !input.config || !input.config.isComplete();
    return (
        <>
            <Card ref={ref}>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <ConfigTitle configType={input.configType} iconSize="md" />
                        {needsConfiguration && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                                <AlertTriangle className="w-3 h-3" />
                                Needs Configuration
                            </Badge>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="min-w-xs max-w-xs">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </CardContent>

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