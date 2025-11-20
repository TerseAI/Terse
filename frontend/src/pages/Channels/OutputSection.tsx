import { forwardRef, ReactNode, useState } from "react";
import { TransientChannelOutput } from "../../shared/types";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";
import { FileText, Plus, AlertTriangle } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigTitle } from "./components/ConfigTitle";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { v4 as uuidv4 } from 'uuid';
import { ConfigInstance, ConfigType } from "@/shared/Configs";

type OutputSectionProps = {
    subtitle?: string;
    children?: ReactNode;
    icon?: ReactNode;
    output: TransientChannelOutput | undefined;
    setOutput: (output: TransientChannelOutput | undefined) => void;
    isLoading: boolean;
}
export const OutputSection = forwardRef<HTMLDivElement, OutputSectionProps>(({ output, setOutput, isLoading }, ref) => {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (configType: ConfigType) => {
        // Clear all configs when switching platform (new integration type)
        const newOutput: TransientChannelOutput = {
            id: uuidv4(),
            config: undefined,
            configType: configType,
        };
        setOutput(newOutput);
        setShowAddModal(false);
    };

    const handleRemove = () => {
        setOutput(undefined);
    };

    return (
        <SectionLayout
            ref={ref}
            subtitle="The AI will continuously update this document as events come in"
            icon={<FileText className="w-5 h-5 text-destructive" />}
            isLoading={isLoading}
        >
            {!output ? (
                <EmptyOutputSection onCreateNew={() => setShowAddModal(true)} />
            ) : (
                <OutputCard output={output} handleRemove={handleRemove} setOutput={setOutput} />
            )}

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </SectionLayout>
    );
})

function OutputCard({ 
    output, 
    handleRemove,
    setOutput
}: { output: TransientChannelOutput, handleRemove: () => void, setOutput: (output: TransientChannelOutput) => void }) {

    function onSelect(config: ConfigInstance) {
        setOutput({ ...output, config: config, configType: config.configType });
    }

    // Output needs configuration if there's no config OR if the config is not complete
    const needsConfiguration = !output.config || !output.config.isComplete();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <ConfigTitle configType={output.configType} iconSize="lg" />
                    {needsConfiguration && (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Configuration
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="max-w-xs">
                <IntegrationSelector input={output} variant="dialog" setConfig={onSelect} />
            </CardContent>
            <CardFooter>
                <Button variant="destructive" onClick={handleRemove}>
                    Remove
                </Button>
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