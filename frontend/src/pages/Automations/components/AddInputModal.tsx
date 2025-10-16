import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Integration } from "../../../context/Integrations";
import { IconForInputType } from "./Integration";

interface AddInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectIntegration: (integration: Integration) => void;
}

export function AddInputModal({ isOpen, onClose, onSelectIntegration }: AddInputModalProps) {
    const availableIntegrations = [
        { type: Integration.GITHUB, name: "GitHub" },
        { type: Integration.LINEAR, name: "Linear" },
        { type: Integration.JIRA, name: "Jira" },
        { type: Integration.SLACK, name: "Slack" },
        { type: Integration.NOTION, name: "Notion" },
    ];

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-md rounded-lg bg-[theme(background-elevated)] p-6 shadow-xl">
                    <DialogTitle className="text-lg font-bold text-[theme(text-primary)] mb-4">
                        Select Integration
                    </DialogTitle>

                    <div className="grid grid-cols-2 gap-4">
                        {availableIntegrations.map((integration) => (
                            <button
                                key={integration.type}
                                onClick={() => onSelectIntegration(integration.type)}
                                className="flex flex-col items-center gap-2 p-4 rounded-lg hover:border-[theme(text-primary)] hover:bg-[theme(background-surface)] transition-colors"
                            >
                                <div className="w-18 h-18 flex items-center justify-center">
                                    <IconForInputType type={integration.type} />
                                </div>
                                <span className="text-sm text-[theme(text-primary)]">{integration.name}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 w-full px-4 py-2 bg-[theme(background-surface)] text-[theme(text-primary)] rounded-lg hover:bg-[theme(background-hover)] transition-colors"
                    >
                        Cancel
                    </button>
                </DialogPanel>
            </div>
        </Dialog>
    );
}
