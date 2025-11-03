import { useState } from "react";
import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";
import { FileText, Plus } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { clearIntegrationConfigs } from "../../utility/IntegrationUtils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationTitle } from "./components/IntegrationTitle";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

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
            console.log("Output:", JSON.stringify(output, null, 2));
            // Clear all configs when switching integration instances (will be re-selected when selector loads)
            const clearedConfigs = clearIntegrationConfigs(output);
            console.log("Cleared configs:", JSON.stringify(clearedConfigs, null, 2));
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
                <EmptyOutputSection onCreateNew={() => setShowAddModal(true)} />
            ) : (
                <OutputCard output={output} handleRemove={handleRemove} handleSelectIntegration={handleSelectIntegration} setOutput={setOutput} />
            )}

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
}

function OutputCard({ 
    output, 
    handleRemove,
    handleSelectIntegration,
    setOutput
}: { output: Output, handleRemove: () => void, handleSelectIntegration: (integrationId: string) => void, setOutput: (output: Output) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between">
                    <IntegrationTitle integration={output.integration} iconSize="lg" />
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
                            setOutput({
                                integration: Integration.NOTION,
                                integrationId: output.integrationId,
                                notionConfig: config
                            });
                        }
                    }}
                    notionPageConfig={output.notionPageConfig}
                    onNotionPageConfigChange={(config) => {
                        if (output) {
                            setOutput({
                                integration: Integration.NOTION_PAGE,
                                integrationId: output.integrationId,
                                notionPageConfig: config
                            });
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

function EmptyOutputSection({ onCreateNew }: { onCreateNew: () => void }) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileText className="text-destructive" />
                </EmptyMedia>
                <EmptyTitle>No output yet</EmptyTitle>
                <EmptyDescription>
                    No output yet. Add an integration to get started.
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button
                    variant="outline"
                    onClick={onCreateNew}
                >
                    <Plus className="h-4 w-4" />
                    Add Output
                </Button>
            </EmptyContent>
        </Empty>
    );
}