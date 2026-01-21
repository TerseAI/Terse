import { Trash, Pencil } from 'lucide-react';
import { Agent } from '../../shared/types';

interface ActionButtonsProps {
    channel: Agent;
    onEdit: (channel: Agent) => void;
    onDelete: (channel: Agent) => void;
}

export function ActionButtons({ channel, onEdit, onDelete }: ActionButtonsProps) {
    return (
        <div className="flex gap-2">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit(channel);
                }}
                className="p-1 text-primary hover:scale-110 rounded transition-colors cursor-pointer"
                title="Edit agent"
            >
                <Pencil className="h-5 w-5" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(channel);
                }}
                className="p-1 text-destructive hover:scale-110 rounded transition-colors cursor-pointer"
                title="Delete agent"
            >
                <Trash className="h-5 w-5" />
            </button>
        </div>
    );
}
