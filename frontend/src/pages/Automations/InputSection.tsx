import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, X } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { getIntegrationTypeName } from "../../utility/IntegrationFormatters";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InputsSection() {
    const { inputs, setInputs } = useAutomationContext();
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
        <SectionLayout
            title="Listen For Events"
            subtitle="Choose which integration triggers this automation"
            icon={<Zap className="w-5 h-5 text-primary" />}
        >
            {!input ? (
                <div className="text-center py-4 px-4">
                    <p className="text-xs text-muted-foreground mb-3">
                        No event source yet. Add an integration to get started.
                    </p>
                    <Button
                        onClick={() => setShowAddModal(true)}
                    >
                        + Add Event Source
                    </Button>
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <div className="flex items-center gap-2 justify-between">
                                {getIntegrationTypeName(input.integration)}
                                <Button variant="ghost" size="icon" onClick={handleRemove}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </CardTitle>
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
                </Card>
            )}

            <AddInputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
}
