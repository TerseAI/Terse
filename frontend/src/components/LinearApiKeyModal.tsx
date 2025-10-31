import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { BackendProvider } from "../services/backend";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface LinearApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function LinearApiKeyModal({ isOpen, onClose, onSuccess }: LinearApiKeyModalProps) {
    const [apiKey, setApiKey] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (!apiKey.trim()) {
            setError("API key is required");
            return;
        }

        setIsLoading(true);
        try {
            await BackendProvider.setLinearApiKey(apiKey.trim());
            setApiKey("");
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Error setting Linear API key:", err);
            const backendMessage = err?.response?.data?.error || err?.message || "Failed to connect. Please check your API key and try again.";
            const isForbidden = (err?.response?.status === 403) || /forbidden/i.test(backendMessage);
            const mentionsAdmin = /workspace admin|admin required/i.test(backendMessage);
            const enhanced = (isForbidden || mentionsAdmin)
                ? "You must be a Linear workspace admin to connect webhooks. Ask an admin to connect Linear or grant you admin access, then try again."
                : backendMessage;
            setError(enhanced);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        console.log('LinearApiKeyModal handleClose called, isLoading:', isLoading);
        if (!isLoading) {
            setApiKey("");
            setError(null);
            onClose();
        }
    };

    
    // Always render the Dialog, let Headless UI handle visibility
    return (
        <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-xl bg-[theme(background)] p-6 shadow-2xl border border-[theme(border)]">
                    <div className="flex items-center justify-between mb-4">
                        <DialogTitle className="text-xl font-bold text-[theme(text-primary)]">
                            Connect Linear
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
                        Enter your Linear API key to connect your workspace. You can create an API key in your{" "}
                        <a 
                            href="https://linear.app/settings/api" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[theme(--color-accent)] hover:underline"
                        >
                            Linear settings
                        </a>
                        .
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="linear-api-key" className="block text-sm font-medium text-[theme(text-primary)] mb-2">
                                API Key
                            </label>
                            <input
                                id="linear-api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 rounded-lg border border-[theme(border)] bg-[theme(background)] text-[theme(text-primary)] placeholder:text-[theme(text-secondary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your Linear API key"
                                autoFocus
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
                                disabled={isLoading || !apiKey.trim()}
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

