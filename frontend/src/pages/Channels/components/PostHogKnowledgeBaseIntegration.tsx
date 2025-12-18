import { PosthogConfig } from "@/shared/Configs";
import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector";
import { usePosthogIntegrations } from "@/hooks/api/usePosthogIntegrations";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function PostHogKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = usePosthogIntegrations();
    const posthogConfig = (knowledgeBase.config as PosthogConfig) || new PosthogConfig('', false, false);
    const selectedIntegrationId = posthogConfig.integrationId || null;

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

    const updateIntegrationId = (integrationId: string) => {
        const newPosthogConfig = new PosthogConfig(
            integrationId,
            posthogConfig.canReadLogs,
            posthogConfig.canReadSessionRecordings
        );
        setConfig(newPosthogConfig);
    };

    const updateCanReadLogs = (canReadLogs: boolean) => {
        const newPosthogConfig = new PosthogConfig(
            posthogConfig.integrationId,
            canReadLogs,
            posthogConfig.canReadSessionRecordings
        );
        setConfig(newPosthogConfig);
    };

    const updateCanReadSessionRecordings = (canReadSessionRecordings: boolean) => {
        const newPosthogConfig = new PosthogConfig(
            posthogConfig.integrationId,
            posthogConfig.canReadLogs,
            canReadSessionRecordings
        );
        setConfig(newPosthogConfig);
    };
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>PostHog Integration</Label>
                <Select
                    value={selectedIntegrationId || ''}
                    onValueChange={updateIntegrationId}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                    <SelectContent>
                        {integrations.map((integration) => (
                            <SelectItem key={integration.id} value={integration.id}>
                                {integration.email || integration.id} {integration.orgName ? `(${integration.orgName})` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                <Label>Available Tools</Label>
                <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="read-logs"
                            checked={posthogConfig.canReadLogs}
                            onCheckedChange={updateCanReadLogs}
                        />
                        <Label htmlFor="read-logs" className="font-normal cursor-pointer">
                            Read logs
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="read-session-recordings"
                            checked={posthogConfig.canReadSessionRecordings}
                            onCheckedChange={updateCanReadSessionRecordings}
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

