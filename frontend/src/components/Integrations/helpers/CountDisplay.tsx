import { Skeleton } from "../../ui/skeleton"

interface CountDisplayProps {
    count: number
    singular: string
    plural?: string
    isLoading: boolean
    skeletonWidth?: string
    additionalInfo?: string
}

export function CountDisplay({ count, singular, plural, isLoading, skeletonWidth = "w-[70px]", additionalInfo }: CountDisplayProps) {
    if (isLoading) {
        return <Skeleton className={`${skeletonWidth} h-4`} />
    }

    const label = count !== 1 ? plural || `${singular}s` : singular

    return (
        <span>
            <span className="font-semibold text-foreground">{count}</span> {label}
            {additionalInfo && <span className="text-muted-foreground"> {additionalInfo}</span>}
        </span>
    )
}
