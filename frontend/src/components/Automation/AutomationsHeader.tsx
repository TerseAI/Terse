import { PlusIcon } from '@heroicons/react/24/outline';

interface AutomationsHeaderProps {
    onCreateNew: () => void;
}

export function AutomationsHeader({ onCreateNew }: AutomationsHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-bold text-white">Automations</h1>
            <button
                onClick={onCreateNew}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[theme(--color-accent)] rounded-lg hover:bg-[theme(--color-accent)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[theme(--color-accent)] transition-colors"
            >
                <PlusIcon className="h-5 w-5" />
                New Automation
            </button>
        </div>
    );
}
