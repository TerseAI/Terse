import { useState, useEffect } from "react";
import { PosthogConfig } from "@/shared/Configs";
import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector";
import { usePosthogIntegrations } from "@/hooks/api/usePosthogIntegrations";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export function PostHogKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = usePosthogIntegrations();
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(
        knowledgeBase.config?.integrationId || null
    );
    const [canReadLogs, setCanReadLogs] = useState<boolean>(
        (knowledgeBase.config as PosthogConfig)?.canReadLogs || false
    );
    const [canReadSessionRecordings, setCanReadSessionRecordings] = useState<boolean>(
        (knowledgeBase.config as PosthogConfig)?.canReadSessionRecordings || false
    );

    // Update config when selections change
    useEffect(() => {
        if (selectedIntegrationId && integrations.length > 0) {
            const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);
            if (selectedIntegration) {
                const newConfig = new PosthogConfig(
                    selectedIntegrationId,
                    canReadLogs,
                    canReadSessionRecordings
                );
                setConfig(newConfig);
            }
        }
    }, [selectedIntegrationId, canReadLogs, canReadSessionRecordings, integrations, setConfig]);

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />;
    }

    if (integrations.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                No PostHog integrations available. Please add a PostHog integration first.
            </div>
        );
    }

    if (variant === 'card') {
        const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId);
        return (
            <div className="text-xs text-center">
                {selectedIntegration ? selectedIntegration.email || selectedIntegration.id : 'Select integration'}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>PostHog Integration</Label>
                <select
                    value={selectedIntegrationId || ''}
                    onChange={(e) => setSelectedIntegrationId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                >
                    <option value="">Select an integration</option>
                    {integrations.map((integration) => (
                        <option key={integration.id} value={integration.id}>
                            {integration.email || integration.id} {integration.orgName ? `(${integration.orgName})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-3">
                <Label>Available Tools</Label>
                <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="read-logs"
                            checked={canReadLogs}
                            onCheckedChange={(checked) => setCanReadLogs(checked === true)}
                        />
                        <Label htmlFor="read-logs" className="font-normal cursor-pointer">
                            Read logs
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="read-session-recordings"
                            checked={canReadSessionRecordings}
                            onCheckedChange={(checked) => setCanReadSessionRecordings(checked === true)}
                        />
                        <Label htmlFor="read-session-recordings" className="font-normal cursor-pointer">
                            Look at relevant session recordings
                        </Label>
                    </div>
                </div>
            </div>
        </div>
    );
}

