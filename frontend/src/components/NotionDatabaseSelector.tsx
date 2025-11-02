import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { NotionDatabase, NotionDatabasesResponse } from "../shared/types";
import { RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";

interface NotionDatabaseSelectorProps {
    integrationId: string;
    selectedDatabaseId?: string;
    onSelect: (databaseId: string, databaseName?: string) => void;
}

export function NotionDatabaseSelector({
    integrationId,
    selectedDatabaseId,
    onSelect
}: NotionDatabaseSelectorProps) {
    const [databases, setDatabases] = useState<NotionDatabase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDatabases = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response: NotionDatabasesResponse = await BackendProvider.getNotionDatabases(integrationId);
            setDatabases(response.databases);

            // Only auto-select if no database is currently selected
            if (!selectedDatabaseId && response.databases.length > 0) {
                // Try to use the connection's default database first
                let dbToSelect: NotionDatabase | undefined;
                if (response.selectedDatabaseId) {
                    dbToSelect = response.databases.find(db => db.id === response.selectedDatabaseId);
                }
                // Fall back to first database if no default is available
                if (!dbToSelect) {
                    dbToSelect = response.databases[0];
                }
                if (dbToSelect) {
                    onSelect(dbToSelect.id, dbToSelect.title);
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
            fetchDatabases();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [integrationId]);

    const handleRefresh = () => {
        fetchDatabases(true);
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

    if (databases.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                No databases found. Make sure your Notion integration has access to databases.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                    Select Database
                </label>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0 px-1 text-xs text-primary hover:text-primary hover:underline"
                    title="Refresh database list"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <Select
                value={selectedDatabaseId || ''}
                onValueChange={(value) => {
                    const selectedDb = databases.find(db => db.id === value);
                    if (selectedDb) {
                        onSelect(selectedDb.id, selectedDb.title);
                    }
                }}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="-- Select a database --" />
                </SelectTrigger>
                <SelectContent>
                    {databases.map((db) => (
                        <SelectItem key={db.id} value={db.id}>
                            {db.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {databases.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {databases.length} database{databases.length !== 1 ? 's' : ''} available
                </div>
            )}
        </div>
    );
}

