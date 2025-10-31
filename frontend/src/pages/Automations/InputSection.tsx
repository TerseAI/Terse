import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { Zap, X } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { getIntegrationTypeName } from "../../utility/IntegrationFormatters";

export function InputsSection() {
    const { inputs, setInputs } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);

    const input = inputs[0]; // Only one input allowed

    const handleSelectPlatform = (integration: Integration) => {
        const newInput: Input = { integration };
        setInputs([newInput]);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string) => {
        if (input) {
            setInputs([{ ...input, integrationId }]);
        }
    };

    const handleRemove = () => {
        setInputs([]);
    };

    return (
        <SectionLayout
            title="Listen For Events"
            subtitle="Choose which integration triggers this automation"
            icon={<Zap className="w-5 h-5 text-accent" />}
        >
            {!input ? (
                <div className="text-center py-4 px-4">
                    <p className="text-xs text-muted-foreground mb-3">
                        No event source yet. Add an integration to get started.
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:brightness-110 transition-all text-sm font-medium"
                    >
                        + Add Event Source
                    </button>
                </div>
            ) : (
                <div className="p-4 rounded-lg border border-input bg-background">
                    <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-foreground">
                            {getIntegrationTypeName(input.integration)}
                        </div>
                        <button
                            onClick={handleRemove}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <IntegrationSelector
                        integrationType={input.integration}
                        selectedIntegrationId={input.integrationId}
                        onSelect={handleSelectIntegration}
                    />
                </div>
            )}

            <AddInputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
}
