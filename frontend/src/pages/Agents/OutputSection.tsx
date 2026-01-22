import { TransientAgentOutput } from "../../shared/types";
import { AlertTriangle } from "lucide-react";
import { IntegrationSelector } from "../../components/IntegrationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigTitle } from "./components/ConfigTitle";
import { Badge } from "@/components/ui/badge";
import { ConfigInstance } from "@/shared/Configs";


export function OutputCard({ 
    output, 
    handleRemove,
    setOutput
}: { output: TransientAgentOutput, handleRemove: () => void, setOutput: (output: TransientAgentOutput) => void }) {

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