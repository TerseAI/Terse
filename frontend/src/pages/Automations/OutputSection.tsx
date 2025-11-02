import { useState } from "react";
import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";
import { FileText } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IntegrationTitle } from "./components/IntegrationTitle";
import { IntegrationBadge } from "./components/IntegrationBadge";

export function OutputSection() {
    const { output, setOutput } = useAutomationContext();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

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
                <>
                    <OutputCard output={output} onDetails={() => setShowDetailsModal(true)} />
                    <OutputDetailsDialog
                        output={output}
                        isOpen={showDetailsModal}
                        onClose={() => setShowDetailsModal(false)}
                        handleRemove={handleRemove}
                        handleSelectIntegration={handleSelectIntegration}
                        setOutput={setOutput}
                    />
                </>
            )}

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
}

function OutputCard({ output, onDetails }: { output: Output, onDetails: () => void }) {
    return (
        <Card onClick={onDetails} className="cursor-pointer">
            <CardHeader>
                <CardTitle>
                    <IntegrationTitle integration={output.integration} iconSize="lg" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <IntegrationBadge integrationId={output.integrationId} integrationType={output.integration} />
            </CardContent>
        </Card>
    );
}

function OutputDetailsDialog({
    output,
    isOpen,
    onClose,
    handleRemove,
    handleSelectIntegration,
    setOutput
}: {
    output: Output,
    isOpen: boolean,
    onClose: () => void,
    handleRemove: () => void,
    handleSelectIntegration: (integrationId: string) => void,
    setOutput: (output: Output) => void
}) {

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        <IntegrationTitle integration={output.integration} iconSize="sm" />
                    </DialogTitle>
                </DialogHeader>

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
                <DialogFooter>
                    <div className="flex items-center justify-start gap-2 w-full">
                        <Button variant="destructive" onClick={handleRemove}>
                            Remove Output
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
