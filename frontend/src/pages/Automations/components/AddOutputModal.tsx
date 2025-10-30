import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Integration } from "../../../context/Integrations";
import { getAllOutputIntegrationMetadata } from "../../../utility/IntegrationUtils";
import { IconForInputType } from "./Integration";

interface AddOutputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectIntegration: (integration: Integration) => void;
}

export function AddOutputModal({ isOpen, onClose, onSelectIntegration }: AddOutputModalProps) {
    // Get all integration metadata with output-specific descriptions
    const allIntegrations = getAllOutputIntegrationMetadata();

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-lg rounded-xl bg-[theme(background)] p-6 shadow-2xl border border-[theme(border)]">
                    <DialogTitle className="text-xl font-bold text-[theme(text-primary)] mb-2">
                        Choose Living Document
                    </DialogTitle>
                    <p className="text-sm text-[theme(text-secondary)] mb-6">
                        Select where the AI will continuously update content
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {allIntegrations.map((integration) => (
                            <button
                                key={integration.type}
                                onClick={() => onSelectIntegration(integration.type)}
                                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-[theme(border)] hover:border-[theme(--color-accent-tertiary)] hover:bg-[theme(background-light)] transition-all duration-200 group"
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
                        className="mt-6 w-full px-4 py-2.5 bg-[theme(background-light)] text-[theme(text-primary)] rounded-lg hover:bg-[theme(background-hover)] transition-colors font-medium"
                    >
                        Cancel
                    </button>
                </DialogPanel>
            </div>
        </Dialog>
    );
}

