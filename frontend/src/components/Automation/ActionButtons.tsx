import { Trash, Pencil } from 'lucide-react';
import { Automation } from '../../shared/types';

interface ActionButtonsProps {
    automation: Automation;
    onEdit: (automation: Automation) => void;
    onDelete: (automation: Automation) => void;
}

export function ActionButtons({ automation, onEdit, onDelete }: ActionButtonsProps) {
    return (
        <div className="flex gap-2">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit(automation);
                }}
                className="p-1 text-primary hover:scale-110 rounded transition-colors cursor-pointer"
                title="Edit automation"
            >
                <Pencil className="h-5 w-5" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(automation);
                }}
                className="p-1 text-destructive hover:scale-110 rounded transition-colors cursor-pointer"
                title="Delete automation"
            >
                <Trash className="h-5 w-5" />
            </button>
        </div>
    );
}
