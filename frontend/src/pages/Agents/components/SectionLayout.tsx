import { ReactNode, forwardRef } from "react"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface SectionLayoutProps {
    subtitle?: string
    children: ReactNode
    icon?: ReactNode
    isLoading?: boolean
}

export const SectionLayout = forwardRef<HTMLDivElement, SectionLayoutProps>(({ subtitle = "", children, icon, isLoading = false }, ref) => {
    if (isLoading) {
        return <SectionLayoutSkeleton showIcon={!!icon} showSubtitle={!!subtitle} />
    }

    return (
        <div ref={ref} className="grid grid-flow-row">
            {/* <div className="flex items-center gap-2.5">
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
            </div> */}
            <div className="p-4 h-full flex flex-col items-center justify-center">{children}</div>
        </div>
    )
})

interface SectionLayoutSkeletonProps {
    showIcon?: boolean
    showSubtitle?: boolean
}

export function SectionLayoutSkeleton({ showIcon: _showIcon = false, showSubtitle: _showSubtitle = false }: SectionLayoutSkeletonProps) {
    return (
        <div className="grid grid-flow-row">
            <div className="p-4 h-full flex flex-col items-center justify-center">
                <Card className="w-full">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <Skeleton className="h-5 w-[180px]" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full min-w-60" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-9 w-[100px]" />
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
