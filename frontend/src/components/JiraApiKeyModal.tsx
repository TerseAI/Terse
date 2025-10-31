import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { BackendProvider } from "../services/backend";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface JiraApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function JiraApiKeyModal({ isOpen, onClose, onSuccess }: JiraApiKeyModalProps) {
    const [email, setEmail] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (!email.trim()) {
            setError("Email is required");
            return;
        }
        if (!baseUrl.trim()) {
            setError("Jira URL is required");
            return;
        }
        if (!apiKey.trim()) {
            setError("API key is required");
            return;
        }

        // Validate URL format
        let normalizedUrl = baseUrl.trim();
        if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
            normalizedUrl = `https://${normalizedUrl}`;
        }
        
        try {
            new URL(normalizedUrl);
        } catch {
            setError("Please enter a valid URL (e.g., your-domain.atlassian.net or https://your-domain.atlassian.net)");
            return;
        }

        setIsLoading(true);
        try {
            await BackendProvider.setJiraApiKey(email.trim(), normalizedUrl, apiKey.trim());
            setEmail("");
            setBaseUrl("");
            setApiKey("");
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error setting Jira API key:", err);
            setError(err.response?.data?.error || err.message || "Failed to connect. Please check your credentials and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setEmail("");
            setBaseUrl("");
            setApiKey("");
            setError(null);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-xl bg-[theme(background)] p-6 shadow-2xl border border-[theme(border)]">
                    <div className="flex items-center justify-between mb-4">
                        <DialogTitle className="text-xl font-bold text-[theme(text-primary)]">
                            Connect Jira
                        </DialogTitle>
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="text-[theme(text-secondary)] hover:text-[theme(text-primary)] transition-colors disabled:opacity-50"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-sm text-[theme(text-secondary)] mb-6">
                        Enter your Jira credentials to connect your instance. You can create an API token in your{" "}
                        <a 
                            href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[theme(--color-accent)] hover:underline"
                        >
                            Atlassian account settings
                        </a>
                        .
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="jira-email" className="block text-sm font-medium text-[theme(text-primary)] mb-2">
                                Email
                            </label>
                            <input
                                id="jira-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 rounded-lg border border-[theme(border)] bg-[theme(background)] text-[theme(text-primary)] placeholder:text-[theme(text-secondary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="your.email@example.com"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label htmlFor="jira-url" className="block text-sm font-medium text-[theme(text-primary)] mb-2">
                                Jira URL
                            </label>
                            <input
                                id="jira-url"
                                type="text"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 rounded-lg border border-[theme(border)] bg-[theme(background)] text-[theme(text-primary)] placeholder:text-[theme(text-secondary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="your-domain.atlassian.net"
                            />
                            <p className="text-xs text-[theme(text-secondary)] mt-1">
                                Your Jira instance URL (e.g., your-domain.atlassian.net)
                            </p>
                        </div>

                        <div>
                            <label htmlFor="jira-api-key" className="block text-sm font-medium text-[theme(text-primary)] mb-2">
                                API Token
                            </label>
                            <input
                                id="jira-api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 rounded-lg border border-[theme(border)] bg-[theme(background)] text-[theme(text-primary)] placeholder:text-[theme(text-secondary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your Jira API token"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <p className="text-sm text-red-500">{error}</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 bg-[theme(background-light)] text-[theme(text-primary)] rounded-lg hover:bg-[theme(background-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !email.trim() || !baseUrl.trim() || !apiKey.trim()}
                                className="flex-1 px-4 py-2.5 bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        Connecting...
                                    </>
                                ) : (
                                    "Connect"
                                )}
                            </button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}

