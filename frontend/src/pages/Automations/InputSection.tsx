import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";
import { BoltIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
            icon={<BoltIcon className="w-5 h-5 text-[theme(--color-accent)]" />}
        >
            {!input ? (
                <div className="text-center py-4 px-4">
                    <p className="text-xs text-[theme(text-secondary)] mb-3">
                        No event source yet. Add an integration to get started.
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all text-sm font-medium"
                    >
                        + Add Event Source
                    </button>
                </div>
            ) : (
                <div className="p-4 rounded-lg border border-[theme(border)] bg-[theme(background-surface)]">
                    <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-[theme(text-primary)]">
                            {getIntegrationTypeName(input.integration)}
                        </div>
                        <button
                            onClick={handleRemove}
                            className="text-[theme(text-secondary)] hover:text-[theme(--color-accent-danger)] transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
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
