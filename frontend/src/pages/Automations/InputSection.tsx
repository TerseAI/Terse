import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, Plus, Settings } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { IntegrationTitle } from "./components/IntegrationTitle";
import { IntegrationBadge } from "./components/IntegrationBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export function InputsSection() {
    const { inputs, setInputs, isLoading } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const input = inputs[0]; // Only one input allowed

    const handleSelectPlatform = (integration: Integration) => {
        // Clear all configs when switching platform (new integration type)
        const clearedConfigs = input ? clearIntegrationConfigs(input) : {};
        const newInput: Input = {
            integration,
            ...clearedConfigs
        };
        setInputs([newInput]);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string) => {
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

    if (isLoading) {
        return <Spinner />;
    }

    return (
        <SectionLayout
            title="Listen For Events"
            subtitle="Choose which integration triggers this automation"
            icon={<Zap className="w-5 h-5 text-primary" />}
        >
            {!input ? (
                <EmptyInputSection onCreateNew={() => setShowAddModal(true)} />
            ) : (
                <>
                    <InputCard input={input} onDetails={() => setShowDetailsModal(true)} />
                    <InputDetailsDialog
                        input={input}
                        isOpen={showDetailsModal}
                        onClose={() => setShowDetailsModal(false)}
                        handleRemove={handleRemove}
                        handleSelectIntegration={handleSelectIntegration}
                        setInputs={setInputs}
                    />
                </>
            )}

            <AddInputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />

        </SectionLayout>
    );
}

function InputCard({ input, onDetails }: { input: Input, onDetails: () => void }) {
    return (
        <Card onClick={onDetails} className="cursor-pointer">
            <CardHeader>
                <CardTitle>
                    <IntegrationTitle integration={input.integration} iconSize="sm" />
                </CardTitle>
            </CardHeader>

            <CardContent>
                <IntegrationBadge integrationId={input.integrationId} integrationType={input.integration} />
            </CardContent>
        </Card>
    );
}

function InputDetailsDialog({
    input,
    isOpen,
    onClose,
    handleRemove,
    handleSelectIntegration,
    setInputs
}: { input: Input, isOpen: boolean, onClose: () => void, handleRemove: () => void, handleSelectIntegration: (integrationId: string) => void, setInputs: (inputs: Input[]) => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        <IntegrationTitle integration={input.integration} iconSize="sm" />
                    </DialogTitle>
                    <DialogDescription>
                        Configure your event source integration
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <IntegrationSelector
                        integrationType={input.integration}
                        selectedIntegrationId={input.integrationId}
                        onSelect={handleSelectIntegration}
                        notionConfig={input.notionConfig}
                        onNotionConfigChange={(config) => {
                            if (input) {
                                setInputs([{ ...input, notionConfig: config }]);
                            }
                        }}
                        slackConfig={input.slackConfig}
                        onSlackConfigChange={(config) => {
                            if (input) {
                                setInputs([{ ...input, slackConfig: config }]);
                            }
                        }}
                    />
                </div>
                <DialogFooter>
                    <div className="flex items-center justify-start gap-2 w-full">
                        <Button variant="destructive" onClick={handleRemove}>
                            Remove Event Source
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
                    variant="default"
                    onClick={onCreateNew}
                >
                    <Plus className="h-4 w-4" />
                    Add Event Source
                </Button>
            </EmptyContent>
        </Empty>
    );
}
