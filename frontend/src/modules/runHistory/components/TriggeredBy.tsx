import { User2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useUser } from "@/modules/users/api/useUser"

export default function TriggeredBy({ userId, showLabel = true, className }: Props) {
    const { user, isLoading, isError } = useUser(userId)

    if (!userId) return null

    const wrapperClass = cn("inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground", className)

    if (isLoading) {
        return (
            <span className={wrapperClass}>
                {showLabel && <span className="text-muted-foreground">Triggered by</span>}
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-14 rounded" />
            </span>
        )
    }

    if (isError || !user) {
        return (
            <span className={wrapperClass} title="This user is no longer active">
                {showLabel && <span className="text-muted-foreground">Triggered by</span>}
                <Avatar className="size-4 shrink-0">
                    <AvatarFallback>
                        <User2 className="size-2.5" />
                    </AvatarFallback>
                </Avatar>
                <span className="text-foreground/80">Unknown</span>
            </span>
        )
    }

    const name = user.displayName || user.email

    return (
        <span className={wrapperClass} title={user.email ? `${name} · ${user.email}` : name}>
            {showLabel && <span className="text-muted-foreground">Triggered by</span>}
            <Avatar className="size-4 shrink-0">
                {user.displayPhotoUrl ? <AvatarImage src={user.displayPhotoUrl} alt="" /> : null}
                <AvatarFallback className="text-[8px] font-medium">{initialsOf(name)}</AvatarFallback>
            </Avatar>
            <span className="max-w-[140px] truncate text-foreground">{name}</span>
        </span>
    )
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type Props = {
    userId?: string | null
    showLabel?: boolean
    className?: string
}
