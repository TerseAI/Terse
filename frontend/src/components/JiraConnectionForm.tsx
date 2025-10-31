import { useState } from "react";
import { BackendProvider } from "../services/backend";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

interface JiraConnectionFormProps {
    onSuccess: () => void;
    onCancel?: () => void;
}

export function JiraConnectionForm({ onSuccess, onCancel }: JiraConnectionFormProps) {
    const [baseUrl, setBaseUrl] = useState("");
    const [email, setEmail] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [selectedProjectKey, setSelectedProjectKey] = useState<string>("");
    const [projects, setProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
    const [isValidating, setIsValidating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showProjectSelector, setShowProjectSelector] = useState(false);

    const handleValidate = async () => {
        if (!baseUrl.trim() || !email.trim() || !apiKey.trim()) {
            setValidationError("All fields are required");
            return;
        }

        // Basic URL validation
        try {
            new URL(baseUrl);
        } catch {
            setValidationError("Please enter a valid URL");
            return;
        }

        setIsValidating(true);
        setValidationError(null);
        setError(null);

        try {
            const result = await BackendProvider.validateJiraCredentials(baseUrl.trim(), email.trim(), apiKey);
            if (result.valid && result.projects) {
                setProjects(result.projects);
                setShowProjectSelector(true);
                if (result.projects.length === 1) {
                    // Auto-select if only one project
                    setSelectedProjectKey(result.projects[0].key);
                }
            } else {
                setValidationError(result.error || "Invalid credentials");
            }
        } catch (err: any) {
            setValidationError(err.message || "Failed to validate credentials");
        } finally {
            setIsValidating(false);
        }
    };

    const handleConnect = async () => {
        if (!baseUrl.trim() || !email.trim() || !apiKey.trim()) {
            setError("All required fields must be filled");
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const result = await BackendProvider.setJiraApiKey(
                email.trim(),
                baseUrl.trim(),
                apiKey,
                selectedProjectKey || undefined
            );
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
        setBaseUrl("");
        setEmail("");
        setApiKey("");
        setSelectedProjectKey("");
        setProjects([]);
        setShowProjectSelector(false);
        setError(null);
        setValidationError(null);
    };

    return (
        <div className="space-y-4 p-4 rounded-lg border border-[theme(border)] bg-[theme(background)]">
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-[theme(text-primary)] mb-1.5">
                        Base URL <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => {
                            setBaseUrl(e.target.value);
                            setValidationError(null);
                            setShowProjectSelector(false);
                        }}
                        placeholder="https://your-company.atlassian.net"
                        className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
                        disabled={isValidating || isConnecting}
                    />
                    <p className="mt-1 text-xs text-[theme(text-secondary)]">
                        Your Jira instance URL
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-[theme(text-primary)] mb-1.5">
                        Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setValidationError(null);
                            setShowProjectSelector(false);
                        }}
                        placeholder="your-email@example.com"
                        className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
                        disabled={isValidating || isConnecting}
                    />
                    <p className="mt-1 text-xs text-[theme(text-secondary)]">
                        The email address associated with your Jira account
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-[theme(text-primary)] mb-1.5">
                        API Token <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            setValidationError(null);
                            setShowProjectSelector(false);
                        }}
                        placeholder="Your Jira API token"
                        className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
                        disabled={isValidating || isConnecting}
                    />
                    <p className="mt-1 text-xs text-[theme(text-secondary)]">
                        Generate an API token from your Atlassian account settings
                    </p>
                </div>

                {validationError && (
                    <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <ExclamationCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
                    </div>
                )}

                {showProjectSelector && projects.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-[theme(text-primary)] mb-1.5">
                            Project (Optional)
                        </label>
                        <select
                            value={selectedProjectKey}
                            onChange={(e) => setSelectedProjectKey(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
                            disabled={isConnecting}
                        >
                            <option value="">No project selected</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.key}>
                                    {project.name} ({project.key})
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-[theme(text-secondary)]">
                            Optionally select a default project for this connection
                        </p>
                    </div>
                )}

                {showProjectSelector && projects.length > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-green-600 dark:text-green-400">
                            <p className="font-medium">Validated successfully</p>
                            <p className="text-xs mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} available</p>
                        </div>
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
                {!showProjectSelector ? (
                    <>
                        <button
                            onClick={handleValidate}
                            disabled={isValidating || isConnecting || !baseUrl.trim() || !email.trim() || !apiKey.trim()}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isValidating ? "Validating..." : "Validate & Load Projects"}
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

