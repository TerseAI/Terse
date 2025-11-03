import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { NotionResource, NotionResourcesResponse, NotionResourceType } from "../shared/types";
import { RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";

interface NotionDatabaseSelectorProps {
    integrationId: string;
    selectedDatabaseId?: string;
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void;
}

export function NotionDatabaseSelector({
    integrationId,
    selectedDatabaseId,
    onSelect
}: NotionDatabaseSelectorProps) {
    const [resources, setResources] = useState<NotionResource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResources = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response: NotionResourcesResponse = await BackendProvider.getNotionResources(integrationId);
            setResources(response.resources);

            // Only auto-select if no resource is currently selected
            if (!selectedDatabaseId && response.resources.length > 0) {
                // Try to use the connection's default resource first
                let resourceToSelect: NotionResource | undefined;
                if (response.selectedResourceId) {
                    resourceToSelect = response.resources.find(resource => resource.id === response.selectedResourceId);
                }
                // Fall back to first database if no default is available
                if (!resourceToSelect) {
                    resourceToSelect = response.resources[0];
                }
                if (resourceToSelect) {
                    onSelect(resourceToSelect.id, resourceToSelect.title, resourceToSelect.type);
                }
            }
        } catch (err: any) {
            console.error('Error fetching Notion databases:', err);
            setError(err.message || 'Failed to load databases');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (integrationId) {
            fetchResources();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [integrationId]);

    const handleRefresh = () => {
        fetchResources(true);
    };

    if (isLoading) {
        return (
            <div className="text-sm text-muted-foreground">
                Loading databases...
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-destructive">{error}</div>
                <Button
                    onClick={handleRefresh}
                    variant="link"
                    size="sm"
                    className="text-xs h-auto p-0"
                >
                    Try again
                </Button>
            </div>
        );
    }

    if (resources.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                No Notion Pages or Databases found. Make sure your Notion integration has access to pages and databases.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                    Select Page or Database
                </label>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="ghost"
                    size="sm"
                    title="Refresh database list"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <Select
                value={selectedDatabaseId || ''}
                onValueChange={(value) => {
                    const selectedResource = resources.find(resource => resource.id === value);
                    if (selectedResource) {
                        onSelect(selectedResource.id, selectedResource.title, selectedResource.type);
                    }
                }}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="-- Select a database --" />
                </SelectTrigger>
                <SelectContent>
                    {resources.map((resource) => (
                        <SelectItem key={resource.id} value={resource.id}>
                            {resource.type === 'database' ? 'Database' : 'Page'} - {resource.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {resources.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {resources.length} page{resources.length !== 1 ? 's' : ''} or database{resources.length !== 1 ? 's' : ''} available
                </div>
            )}
        </div>
    );
}

