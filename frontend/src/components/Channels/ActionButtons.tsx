import { Trash, Pencil } from 'lucide-react';
import { Channel } from '../../shared/types';

interface ActionButtonsProps {
    channel: Channel;
    onEdit: (channel: Channel) => void;
    onDelete: (channel: Channel) => void;
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
                title="Edit channel"
            >
                <Pencil className="h-5 w-5" />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(channel);
                }}
                className="p-1 text-destructive hover:scale-110 rounded transition-colors cursor-pointer"
                title="Delete channel"
            >
                <Trash className="h-5 w-5" />
            </button>
        </div>
    );
}
