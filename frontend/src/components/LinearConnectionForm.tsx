import { useState } from "react";
import { BackendProvider } from "../services/backend";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

interface LinearConnectionFormProps {
    onSuccess: () => void;
    onCancel?: () => void;
}

export function LinearConnectionForm({ onSuccess, onCancel }: LinearConnectionFormProps) {
    const [apiKey, setApiKey] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [teams, setTeams] = useState<Array<{ id: string; name: string; key: string }>>([]);
    const [workspace, setWorkspace] = useState<{ name: string; id: string } | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showTeamSelector, setShowTeamSelector] = useState(false);

    const handleValidate = async () => {
        if (!apiKey.trim()) {
            setValidationError("API key is required");
            return;
        }

        setIsValidating(true);
        setValidationError(null);
        setError(null);

        try {
            const result = await BackendProvider.validateLinearApiKey(apiKey);
            if (result.valid && result.teams && result.workspace) {
                setTeams(result.teams);
                setWorkspace(result.workspace);
                setShowTeamSelector(true);
                if (result.teams.length === 1) {
                    // Auto-select if only one team
                    setSelectedTeamId(result.teams[0].id);
                }
            } else {
                setValidationError(result.error || "Invalid API key");
            }
        } catch (err: any) {
            setValidationError(err.message || "Failed to validate API key");
        } finally {
            setIsValidating(false);
        }
    };

    const handleConnect = async () => {
        if (!apiKey.trim()) {
            setError("API key is required");
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const result = await BackendProvider.setLinearApiKey(apiKey, selectedTeamId || undefined);
            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || "Failed to create connection");
            }
        } catch (err: any) {
            setError(err.error || err.message || "Failed to create connection");
        } finally {
            setIsConnecting(false);
        }
    };

    const handleReset = () => {
        setApiKey("");
        setSelectedTeamId("");
        setTeams([]);
        setWorkspace(null);
        setShowTeamSelector(false);
        setError(null);
        setValidationError(null);
    };

    return (
        <div className="space-y-4 p-4 rounded-lg border border-[theme(border)] bg-[theme(background)]">
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-[theme(text-primary)] mb-1.5">
                        API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            setValidationError(null);
                            setShowTeamSelector(false);
                        }}
                        placeholder="lin_api_..."
                        className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
                        disabled={isValidating || isConnecting}
                    />
                    <p className="mt-1 text-xs text-[theme(text-secondary)]">
                        Generate an API key from your Linear settings
                    </p>
                </div>

                {validationError && (
                    <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <ExclamationCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
                    </div>
                )}

                {workspace && (
                    <div className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-green-600 dark:text-green-400">
                            <p className="font-medium">Validated successfully</p>
                            <p className="text-xs mt-0.5">Workspace: {workspace.name}</p>
                        </div>
                    </div>
                )}

                {showTeamSelector && teams.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-[theme(text-primary)] mb-1.5">
                            Team (Optional)
                        </label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
                            disabled={isConnecting}
                        >
                            <option value="">No team selected</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name} ({team.key})
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-[theme(text-secondary)]">
                            Optionally select a default team for this connection
                        </p>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <ExclamationCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 pt-2">
                {!showTeamSelector ? (
                    <>
                        <button
                            onClick={handleValidate}
                            disabled={isValidating || isConnecting || !apiKey.trim()}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isValidating ? "Validating..." : "Validate & Load Teams"}
                        </button>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                disabled={isValidating || isConnecting}
                                className="px-4 py-2 text-sm font-medium bg-[theme(background-light)] text-[theme(text-primary)] rounded-lg hover:bg-[theme(background-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isConnecting}
                            className="px-4 py-2 text-sm font-medium bg-[theme(background-light)] text-[theme(text-primary)] rounded-lg hover:bg-[theme(background-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Start Over
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

