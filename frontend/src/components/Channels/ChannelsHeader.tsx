import { Plus } from 'lucide-react';
import { Button } from '../ui/button';

interface ChannelsHeaderProps {
    onCreateNew: () => void;
}

export function ChannelsHeader({ onCreateNew }: ChannelsHeaderProps) {
    return (
        <div className="grid grid-cols-20 sm:grid-flow-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground col-span-16">Channels</h1>
            <Button
                variant="secondary"
                onClick={onCreateNew}
                className="col-span-4"
            >
                <Plus className="h-5 w-5" />
                New Channel
            </Button>
        </div>
    );
}
