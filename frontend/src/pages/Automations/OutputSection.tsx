import { useState } from "react";
import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";
import { DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { clearIntegrationConfigs, getIntegrationName } from "../../utility/IntegrationUtils";

export function OutputSection() {
    const { output, setOutput } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (integration: Integration) => {
        // Clear all configs when switching platform (new integration type)
        const clearedConfigs = output ? clearIntegrationConfigs(output) : {};
        const newOutput: Output = { 
            integration,
            ...clearedConfigs
        };
        setOutput(newOutput);
        setShowAddModal(false);
    };

    const handleSelectIntegration = (integrationId: string) => {
        if (output) {
            // Clear all configs when switching integration instances (will be re-selected when selector loads)
            const clearedConfigs = clearIntegrationConfigs(output);
            setOutput({ 
                ...output, 
                integrationId,
                ...clearedConfigs
            });
        }
    };

    const handleRemove = () => {
        setOutput(undefined);
    };

    return (
        <SectionLayout
            title="Update Living Document"
            subtitle="The AI will continuously update this document as events come in"
            icon={<DocumentTextIcon className="w-5 h-5 text-[theme(--color-accent-tertiary)]" />}
        >
            {!output ? (
                <div className="text-center py-4 px-4">
                    <p className="text-xs text-[theme(text-secondary)] mb-3">
                        Choose where your living document will be updated
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-[theme(--color-accent-tertiary)] text-white rounded-lg hover:brightness-110 transition-all text-sm font-medium"
                    >
                        + Add Output
                    </button>
                </div>
            ) : (
                <div className="p-4 rounded-lg border border-[theme(border)] bg-[theme(background)]">
                    <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-[theme(text-primary)]">
                            {getIntegrationName(output.integration)}
                        </div>
                        <button
                            onClick={handleRemove}
                            className="text-[theme(text-secondary)] hover:text-[theme(--color-accent-danger)] transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <IntegrationSelector
                        integrationType={output.integration}
                        selectedIntegrationId={output.integrationId}
                        onSelect={handleSelectIntegration}
                        notionConfig={output.notionConfig}
                        onNotionConfigChange={(config) => {
                            if (output) {
                                setOutput({ ...output, notionConfig: config });
                            }
                        }}
                        slackConfig={output.slackConfig}
                        onSlackConfigChange={(config) => {
                            if (output) {
                                setOutput({ ...output, slackConfig: config });
                            }
                        }}
                    />
                </div>
            )}

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
}
