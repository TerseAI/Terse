import { forwardRef, useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, Plus, Settings } from "lucide-react";
import { useIntegrationSelector } from "../../components/IntegrationSelector";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { IntegrationTitle } from "./components/IntegrationTitle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FigmaConfig, GmailConfig, NotionConfig, SlackConfig } from "@/shared/types";

export const InputsSection = forwardRef<HTMLDivElement, { ref: React.RefObject<HTMLDivElement> }>((_, ref) => {
    const { inputs, setInputs, isLoading } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (integration: Integration) => {
        // Clear all configs when switching platform (new integration type)
        const newInputs: Input[] = [...inputs, { integration }];
        setInputs(newInputs);
        console.log('Inputs:', newInputs);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string, input: Input) => {
        if (input) {
            // Clear all configs when switching integration instances (will be re-selected when selector loads)
            const clearedConfigs = clearIntegrationConfigs(input);
            setInputs([{
                ...input,
                integrationId,
                ...clearedConfigs
            }]);
        }
    };

    const handleRemove = () => {
        setInputs([]);
    };

    return (
        <SectionLayout ref={ref}
            subtitle="Choose which integration triggers this automation"
            icon={<Zap className="w-5 h-5 text-primary" />}
            isLoading={isLoading}
        >
            {!inputs.length ? (
                <EmptyInputSection onCreateNew={() => setShowAddModal(true)} />
            ) : (
                <InputCardsLayout inputs={inputs} handleSelectIntegration={handleSelectIntegration} setInputs={setInputs} handleRemove={handleRemove} setShowAddModal={setShowAddModal} />
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
    setShowAddModal
}: {
    inputs: Input[], 
    handleSelectIntegration: (integrationId: string, input: Input) => void, 
    setInputs: (inputs: Input[]) => void, 
    handleRemove: () => void, 
    setShowAddModal: (show: boolean) => void}
) {
    return (
        <div className="flex flex-col gap-4">
            {inputs.map((input) => (
                <InputCard key={input.integrationId} input={input} handleSelectIntegration={handleSelectIntegration} setInputs={setInputs} handleRemove={handleRemove} />
            ))}
            <Button variant="outline" onClick={() => setShowAddModal(true)}>
                Add Event Source
            </Button>
        </div>
    );
}

function InputCard({
    input,
    handleSelectIntegration,
    setInputs,
    handleRemove
}: { input: Input, handleSelectIntegration: (integrationId: string, input: Input) => void, setInputs: (inputs: Input[]) => void, handleRemove: () => void }) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    
    const selectorProps = {
        integrationType: input.integration,
        selectedIntegrationId: input.integrationId,
        onSelect: handleSelectIntegration,
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
                setInputs([{ ...input, gmailConfig: config }]);
            }
        }
    };

    const { CardContent: IntegrationCardContent, DialogContent: IntegrationDialogContent } = useIntegrationSelector(selectorProps);

    return (
        <>
            <Card>
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
                    <Button variant="destructive" onClick={handleRemove}>
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
}

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
