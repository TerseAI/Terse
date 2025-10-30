import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Automation } from '../../shared/types';
import { IconForInputType } from '../../pages/Automations/components/Integration';
import { Integration } from '../../context/Integrations';

interface AppsListProps {
    automation: Automation;
}

export function AppsList({ automation }: AppsListProps) {
    const allApps = [
        ...automation.inputs.map(input => input.integration),
        automation.output?.integration
    ].filter(Boolean) as Integration[];

    return (
        <div className="flex items-center gap-1.5">
            {allApps.map((app, idx) => (
                <div key={idx} className="flex items-center">
                    {idx > 0 && (
                        <ChevronRightIcon className="w-3 h-3 text-[theme(text-disabled)] mx-0.5" />
                    )}
                    <div
                        className="w-7 h-7 flex items-center justify-center rounded bg-[theme(background-elevated)] p-1"
                        title={app}
                    >
                        <IconForInputType type={app} />
                    </div>
                </div>
            ))}
        </div>
    );
}
