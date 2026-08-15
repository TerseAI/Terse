import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

type PasswordVisibilityButtonProps = {
    visible: boolean
    onToggle: () => void
    label?: string
    className?: string
    disabled?: boolean
}

export function PasswordVisibilityButton({ visible, onToggle, label = "value", className, disabled }: PasswordVisibilityButtonProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-label={`${visible ? "Hide" : "Show"} ${label}`}
            aria-pressed={visible}
            className={cn(
                "absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none transition-[background-color,color] duration-150 before:absolute before:-inset-1.5 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                className
            )}
        >
            {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
    )
}
