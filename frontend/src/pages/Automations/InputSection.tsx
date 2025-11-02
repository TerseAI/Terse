import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, X, Plus, Settings } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { getIntegrationTypeName } from "../../utility/IntegrationFormatters";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { IconForInputType } from "./components/Integration";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge";

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
                    <InputCard input={input} onDetails={() => setShowDetailsModal(true)} onDelete={handleRemove} />
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

function InputCard({ input, onDetails, onDelete }: { input: Input, onDetails: () => void, onDelete: () => void }) {
    return (
        <Card onClick={onDetails}>
            <CardHeader>
                <CardTitle>
                    <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 flex items-center justify-center">
                                <IconForInputType type={input.integration} />
                            </div>
                            {getIntegrationTypeName(input.integration)}
                        </div>
                        <Button variant="ghost" size="icon" onClick={onDelete}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </CardTitle>
                <CardDescription>
                    <Badge>
                        {input.integrationId}
                    </Badge>
                </CardDescription>
            </CardHeader>
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
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 flex items-center justify-center">
                                <IconForInputType type={input.integration} />
                            </div>
                            {getIntegrationTypeName(input.integration)}
                        </div>
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
                    <Button variant="destructive" onClick={handleRemove}>
                        <X className="w-4 h-4 mr-2" />
                        Remove Event Source
                    </Button>
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
