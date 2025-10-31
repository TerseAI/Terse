import { PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/button';

interface AutomationsHeaderProps {
    onCreateNew: () => void;
}

export function AutomationsHeader({ onCreateNew }: AutomationsHeaderProps) {
    return (
        <div className="grid grid-cols-20 sm:grid-flow-row sm:items-center sm:justify-between gap-4 pt-1">
            <h1 className="text-xl font-bold text-[theme(text-primary)] col-span-16">Automations</h1>
            <Button
                onClick={onCreateNew}
                className="col-span-4 inline-flex items-center justify-center text-sm font-medium text-white transition-colors"
            >
                <PlusIcon className="h-5 w-5" />
                New Automation
            </Button>
        </div>
    );
}
