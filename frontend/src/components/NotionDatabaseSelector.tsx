import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { NotionDatabase, NotionDatabasesResponse } from "../shared/types";
import { RotateCw } from "lucide-react";

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
            <div className="text-sm text-[theme(text-secondary)]">
                Loading databases...
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-red-600">{error}</div>
                <button
                    onClick={handleRefresh}
                    className="text-xs text-[theme(--color-accent)] hover:underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (databases.length === 0) {
        return (
            <div className="text-sm text-[theme(text-secondary)]">
                No databases found. Make sure your Notion integration has access to databases.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[theme(text-secondary)]">
                    Select Database
                </label>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 text-xs text-[theme(--color-accent)] hover:underline disabled:opacity-50"
                    title="Refresh database list"
                >
                    <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>
            <select
                value={selectedDatabaseId || ''}
                onChange={(e) => {
                    const selectedDb = databases.find(db => db.id === e.target.value);
                    if (selectedDb) {
                        onSelect(selectedDb.id, selectedDb.title);
                    }
                }}
                className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
            >
                {!selectedDatabaseId && (
                    <option value="">-- Select a database --</option>
                )}
                {databases.map((db) => (
                    <option key={db.id} value={db.id}>
                        {db.title}
                    </option>
                ))}
            </select>
            {databases.length > 0 && (
                <div className="text-xs text-[theme(text-secondary)]">
                    {databases.length} database{databases.length !== 1 ? 's' : ''} available
                </div>
            )}
        </div>
    );
}

