import { ReactNode } from "react";

interface SectionLayoutProps {
    title: string;
    children: ReactNode;
}

export function SectionLayout({ title, children }: SectionLayoutProps) {
    return (
        <div className="relative flex justify-center items-center">
            <h1 className="absolute left-0 text-lg font-bold text-[theme(text-primary)]">{title}</h1>
            <div className="grid grid-flow-col gap-4">
                {children}
            </div>
        </div>
    );
}

