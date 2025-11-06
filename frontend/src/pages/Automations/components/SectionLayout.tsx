import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionLayoutProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    icon?: ReactNode;
    isLoading?: boolean;
}

export function SectionLayout({ title = "", subtitle = "", children, icon, isLoading = false }: SectionLayoutProps) {
    if (isLoading) {
        return <SectionLayoutSkeleton showIcon={!!icon} showSubtitle={!!subtitle} />;
    }

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

interface SectionLayoutSkeletonProps {
    showIcon?: boolean;
    showSubtitle?: boolean;
}

export function SectionLayoutSkeleton({ showIcon = false, showSubtitle = false }: SectionLayoutSkeletonProps) {
    return (
        <div className="grid grid-cols-20">
            <div className="flex items-center gap-2.5 col-span-4">
                {showIcon && (
                    <Skeleton className="w-8 h-8 rounded-lg" />
                )}
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-[200px]" />
                    {showSubtitle && (
                        <Skeleton className="h-3 w-[150px] mt-0.5" />
                    )}
                </div>
            </div>
            <div className="p-4 col-span-12 flex flex-col items-center">
                <Skeleton className="h-70 w-xs" />
            </div>
        </div>
    );
}

