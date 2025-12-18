import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconForConfigType } from "../components/Integration";
import { Button } from "@/components/ui/button";
import { CONFIG_DETAILS, ConfigType } from "@/shared/Configs";

interface AddKnowledgeBaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectKnowledgeBase: (config: ConfigType) => void;
}

export function AddKnowledgeBaseModal({ isOpen, onClose, onSelectKnowledgeBase }: AddKnowledgeBaseModalProps) {
    // Get all knowledge base config types
    const allConfigTypes = Object.values(ConfigType);
    const knowledgeBaseConfigTypes = allConfigTypes.filter((configType) => CONFIG_DETAILS[configType].isKnowledgeBase);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                        Add Knowledge Base
                    </DialogTitle>
                    <DialogDescription>
                        Choose which knowledge base integration to add
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3">
                    {knowledgeBaseConfigTypes.map((configType) => {
                        const configDetails = CONFIG_DETAILS[configType];
                        return (
                            <button
                                key={configType}
                                onClick={() => onSelectKnowledgeBase(configType)}
                                className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 group"
                            >
                                <div className="w-16 h-16 flex items-center justify-center">
                                    <IconForConfigType type={configType} />
                                </div>
                                <div className="text-center">
                                    <div className="text-sm font-medium text-foreground mb-1">{configDetails.name}</div>
                                    <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{configDetails.description}</div>
                                </div>
                            </button>
                        );
                    })}
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

