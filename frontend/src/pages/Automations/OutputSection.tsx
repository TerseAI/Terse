import { useState } from "react";
import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";
import { FileText, X } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { getIntegrationTypeName } from "../../utility/IntegrationFormatters";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";

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
            icon={<FileText className="w-5 h-5 text-accent" />}
        >
            {!output ? (
                <div className="text-center py-4 px-4">
                    <p className="text-xs text-muted-foreground mb-3">
                        Choose where your living document will be updated
                    </p>
                    <Button
                        onClick={() => setShowAddModal(true)}
                    >
                        + Add Output
                    </Button>
                </div>
            ) : (
                <div className="p-4 rounded-lg border border-input bg-background">
                    <div className="flex items-start justify-between mb-3">
                        <div className="text-sm font-medium text-foreground">
                            {getIntegrationTypeName(output.integration)}
                        </div>
                        <button
                            onClick={handleRemove}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <X className="w-5 h-5" />
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
