import { ChevronRight } from 'lucide-react';
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
    const inputIcons: Integration[] = automation.inputs.map(input => input.integration as Integration);
    const outputIcon: Integration = automation.output?.integration as Integration;

    return (
        <div className="flex items-center gap-1.5">
            <IconStack icons={inputIcons} />
            {inputIcons.length > 0 && (
                <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
            )}
            {outputIcon && (
                <div className="flex items-center">
                    <div className="w-7 h-7 flex items-center justify-center rounded bg-card p-1">
                        <IconForInputType type={outputIcon} />
                    </div>
                </div>
            )}
        </div>
    );
}

function IconStack({ icons }: { icons: Integration[] }) {
    return (
        <div className="flex items-center">
            {icons.map((icon, idx) => (
                <div key={idx} className="flex items-center">
                    <div
                        className={`w-7 h-7 flex items-center justify-center rounded bg-card p-1 z-${idx * 10}`}
                        title={icon}
                    >
                        <IconForInputType type={icon} />
                    </div>
                </div>
            ))}
        </div>
    );
}
