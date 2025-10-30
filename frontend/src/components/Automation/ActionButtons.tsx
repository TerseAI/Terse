import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
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
                className="p-1 text-[theme(--color-accent)] hover:scale-110 rounded transition-colors"
                title="Edit automation"
            >
                <PencilIcon className="h-5 w-5" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(automation);
                }}
                className="p-1 text-[theme(--color-accent-danger)] hover:scale-110 rounded transition-colors"
                title="Delete automation"
            >
                <TrashIcon className="h-5 w-5" />
            </button>
        </div>
    );
}
