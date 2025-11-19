import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconForInputType } from "./Integration";
import { Button } from "@/components/ui/button";
import { CONFIG_DETAILS, ConfigType } from "@/shared/Configs";

interface AddOutputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectIntegration: (configType: ConfigType) => void;
}

export function AddOutputModal({ isOpen, onClose, onSelectIntegration }: AddOutputModalProps) {
    // Get all integration metadata with output-specific descriptions
    const allConfigTypes = Object.values(CONFIG_DETAILS).filter((config) => config.isOutput);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        Choose Living Document
                    </DialogTitle>
                    <DialogDescription>
                        Select where the AI will continuously update content
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3">
                    {allConfigTypes.map((config) => (
                        <button
                            key={config.configType}
                            onClick={() => onSelectIntegration(config.configType)}
                            className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 group"
                        >
                            <div className="w-16 h-16 flex items-center justify-center">
                                <IconForInputType type={config.configType} />
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-medium text-foreground mb-1">{config.name}</div>
                                <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{ config.description}</div>
                            </div>
                        </button>
                    ))}
                </div>

                <DialogFooter>
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="mt-6 w-full"
                    >
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

