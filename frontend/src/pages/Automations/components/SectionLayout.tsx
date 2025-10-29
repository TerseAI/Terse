import { ReactNode } from "react";

interface SectionLayoutProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    icon?: ReactNode;
}

export function SectionLayout({ title, subtitle, children, icon }: SectionLayoutProps) {
    return (
        <div className="flex flex-col gap-3">
            {/* <div className="flex items-center gap-2.5">
                {icon && (
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[theme(background-elevated)]">
                        {icon}
                    </div>
                )}
                <div className="flex flex-col">
                    <h2 className="text-base font-semibold text-[theme(text-primary)]">{title}</h2>
                    {subtitle && (
                        <p className="text-xs text-[theme(text-secondary)] mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div> */}
            <div className=" rounded-lg p-4  transition-all duration-200">
                <div className="flex justify-center items-center min-h-[60px]">
                    <div className="flex flex-wrap gap-3 justify-center">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

