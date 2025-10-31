import { Switch } from '@/components/ui/switch';
import { Automation } from '../../shared/types';

interface StatusToggleProps {
    automation: Automation;
    onToggle: (automation: Automation) => void;
}

export function StatusToggle({ automation, onToggle }: StatusToggleProps) {
    const isActive = automation.isActive;

    return (
        <div className="flex items-center space-x-2">
            <Switch id="airplane-mode" checked={isActive} onCheckedChange={() => onToggle(automation)} onClick={(e) => e.stopPropagation()} />
        </div>
    );
}