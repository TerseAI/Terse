import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Integration, useIntegrations } from "../../../context/Integrations";
import { IconForInputType } from "./Integration";

interface AddInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectIntegration: (integration: Integration) => void;
}

export function AddInputModal({ isOpen, onClose, onSelectIntegration }: AddInputModalProps) {
    const { integrations } = useIntegrations();

    const allIntegrations = [
        { type: Integration.GITHUB, name: "GitHub", description: "Listen to commits, PRs, and issues" },
        { type: Integration.LINEAR, name: "Linear", description: "Track ticket updates" },
        { type: Integration.SLACK, name: "Slack", description: "Monitor channel messages" },
        { type: Integration.GMAIL, name: "Gmail", description: "Monitor incoming emails" },
        { type: Integration.NOTION, name: "Notion", description: "Watch page changes" },
    ];

    // Filter to only show integrations the user has configured
    const availableIntegrations = allIntegrations.filter(integration =>
        integrations.includes(integration.type)
    );

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-lg rounded-xl bg-[theme(background-elevated)] p-6 shadow-2xl border border-[theme(border)]">
                    <DialogTitle className="text-xl font-bold text-[theme(text-primary)] mb-2">
                        Add Event Source
                    </DialogTitle>
                    <p className="text-sm text-[theme(text-secondary)] mb-6">
                        Choose which integration will trigger this automation
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {availableIntegrations.map((integration) => (
                            <button
                                key={integration.type}
                                onClick={() => onSelectIntegration(integration.type)}
                                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-[theme(border)] hover:border-[theme(--color-accent)] hover:bg-[theme(background-surface)] transition-all duration-200 group"
                            >
                                <div className="w-16 h-16 flex items-center justify-center">
                                    <IconForInputType type={integration.type} />
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-medium text-[theme(text-primary)] mb-1">{integration.name}</div>
                                    <div className="text-xs text-[theme(text-secondary)] group-hover:text-[theme(text-primary)] transition-colors">{integration.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 w-full px-4 py-2.5 bg-[theme(background-surface)] text-[theme(text-primary)] rounded-lg hover:bg-[theme(background-hover)] transition-colors font-medium"
                    >
                        Cancel
                    </button>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
