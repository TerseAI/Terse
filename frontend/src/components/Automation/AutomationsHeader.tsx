import { PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';

interface AutomationsHeaderProps {
    onCreateNew: () => void;
}

export function AutomationsHeader({ onCreateNew }: AutomationsHeaderProps) {
    return (
        <div className="grid grid-cols-20 sm:grid-flow-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-xl font-bold text-white col-span-16">Automations</h1>
            <Button
                onClick={onCreateNew}
                className="col-span-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[theme(--color-accent)] rounded-lg hover:bg-[theme(--color-accent)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[theme(--color-accent)] transition-colors"
            >
                <PlusIcon className="h-5 w-5" />
                New Automation
            </Button>
        </div>
    );
}
