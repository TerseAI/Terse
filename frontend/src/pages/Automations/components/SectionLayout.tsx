import { ReactNode } from "react";

interface SectionLayoutProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    icon?: ReactNode;
}

export function SectionLayout({ title = "", subtitle = "", children, icon }: SectionLayoutProps) {
    return (
        <div className="grid grid-cols-20">
            <div className="flex items-center gap-2.5 col-span-4">
                {icon && (
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[theme(background)]">
                        {icon}
                    </div>
                )}
                <div className="flex flex-col">
                    <h2 className="text-base font-semibold text-[theme(text-primary)]">{title}</h2>
                    {subtitle && (
                        <p className="text-xs text-[theme(text-secondary)] mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="p-4 col-span-12 flex flex-col items-center">
                {children}
            </div>
        </div>
    );
}

