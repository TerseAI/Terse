import { Switch } from '@/components/ui/switch';
import { Channel } from '../../shared/types';

interface StatusToggleProps {
    channel: Channel;
    onToggle: (channel: Channel) => void;
}

export function StatusToggle({ channel, onToggle }: StatusToggleProps) {
    const isActive = channel.isActive;

    return (
        <div className="flex items-center space-x-2">
            <Switch id="airplane-mode" checked={isActive} onCheckedChange={() => onToggle(channel)} onClick={(e) => e.stopPropagation()} />
        </div>
    );
}