import { forwardRef, useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, Plus, Settings } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { IntegrationTitle } from "./components/IntegrationTitle";

export const InputsSection = forwardRef<HTMLDivElement, { ref: React.RefObject<HTMLDivElement> }>((_, ref) => {
    const { inputs, setInputs, isLoading } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);
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

    return (
        <SectionLayout ref={ref}
            subtitle="Choose which integration triggers this automation"
            icon={<Zap className="w-5 h-5 text-primary" />}
            isLoading={isLoading}
        >
            {!input ? (
                <EmptyInputSection onCreateNew={() => setShowAddModal(true)} />
            ) : (
                <InputCard input={input} handleSelectIntegration={handleSelectIntegration} setInputs={setInputs} handleRemove={handleRemove} />
            )}

            <AddInputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />

        </SectionLayout>
    );
})

function InputCard({
    input,
    handleSelectIntegration,
    setInputs,
    handleRemove
}: { input: Input, handleSelectIntegration: (integrationId: string) => void, setInputs: (inputs: Input[]) => void, handleRemove: () => void }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between">
                    <IntegrationTitle integration={input.integration} iconSize="md" />
                </div>
            </CardHeader>

            <CardContent>
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
            </CardContent>

            <CardFooter>
                <CardAction>
                    <Button variant="destructive" onClick={handleRemove}>
                        Remove
                    </Button>
                </CardAction>
            </CardFooter>
        </Card>
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
