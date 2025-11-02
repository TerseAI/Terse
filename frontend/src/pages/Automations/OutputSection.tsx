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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
            icon={<FileText className="w-5 h-5 text-destructive" />}
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
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <div className="flex items-center gap-2 justify-between">
                                {getIntegrationTypeName(output.integration)}
                                <Button variant="ghost" size="icon" onClick={handleRemove}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
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
                    </CardContent>
                </Card>
            )}

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
}
