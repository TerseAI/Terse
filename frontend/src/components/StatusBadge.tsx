import { ReactNode } from "react"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import { Badge } from "./ui/badge"

type StatusBadgeProps = {
    // Default text to show user in badge
    text: string
    // If this is a special status, like success or error
    // we use this to determine the color of the badge
    status?: "success" | "error" | "warning" | "tertiary"
    // Optional icon to show in badge (Lucide icon component)
    icon?: LucideIcon
    // Optional custom ReactNode to show instead of the Lucide icon
    iconComponent?: ReactNode
    // Optional additional className for badge
    className?: string
    // Optional additional classname for icon
    iconClassName?: string
}

export default function StatusBadge({ status, text, icon: Icon, iconComponent, className, iconClassName }: StatusBadgeProps) {
    let iconColor = "text-muted-foreground"
    switch (status) {
        case "success":
            iconColor = "text-success"
            break
        case "error":
            iconColor = "text-danger"
            break
        case "warning":
            iconColor = "text-warning"
            break
        case "tertiary":
            iconColor = "text-accent-tertiary"
            break
    }

    return (
        <Badge variant="outline" className={cn("gap-1.5", className)}>
            {Icon ? <Icon className={cn(iconColor, iconClassName)} /> : iconComponent}
            {text}
        </Badge>
    )
}
