import { Plus } from 'lucide-react';
import { Button } from '../ui/button';

interface AutomationsHeaderProps {
    onCreateNew: () => void;
}

export function AutomationsHeader({ onCreateNew }: AutomationsHeaderProps) {
    return (
        <div className="grid grid-cols-20 sm:grid-flow-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground col-span-16">Automations</h1>
            <Button
                variant="secondary"
                onClick={onCreateNew}
                className="col-span-4"
            >
                <Plus className="h-5 w-5" />
                New Automation
            </Button>
        </div>
    );
}
