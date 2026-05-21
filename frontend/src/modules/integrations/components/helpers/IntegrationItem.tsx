import { ReactNode } from "react"

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { cn } from "@/lib/utils"

interface IntegrationItemProps {
    icon: ReactNode
    title: string
    description?: ReactNode
    className?: string
}

export function IntegrationItem({ icon, title, description, className }: IntegrationItemProps) {
    return (
        <Item variant="outline" size="sm" className={cn("rounded-lg", className)}>
            <ItemMedia variant="icon" className="size-8 rounded-full bg-primary/10 [&_svg]:text-primary">
                {icon}
            </ItemMedia>
            <ItemContent>
                <ItemTitle className="truncate">{title}</ItemTitle>
                {description && <ItemDescription className="mt-0.5">{description}</ItemDescription>}
            </ItemContent>
        </Item>
    )
}
