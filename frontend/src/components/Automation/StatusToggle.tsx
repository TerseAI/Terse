import { Automation } from '../../shared/types';

interface StatusToggleProps {
    automation: Automation;
    onToggle: (automation: Automation) => void;
}

export function StatusToggle({ automation, onToggle }: StatusToggleProps) {
    const isActive = automation.isActive;

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggle(automation);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isActive
                    ? 'bg-[theme(--color-success)] focus:ring-[theme(--color-success)]'
                    : 'bg-[theme(text-disabled)] focus:ring-[theme(text-disabled)]'
            }`}
            role="switch"
            aria-checked={isActive}
            title={isActive ? 'Active' : 'Inactive'}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-[theme(text-primary)] transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    );
}
