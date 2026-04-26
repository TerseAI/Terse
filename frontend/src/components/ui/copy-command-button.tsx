import { useState } from "react"

import { Check, Copy, Terminal } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

type CopyCommandButtonProps = {
    command: string
    title?: string
    disabled?: boolean
    className?: string
}

export function CopyCommandButton({ command, title, disabled, className }: CopyCommandButtonProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(command)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy command")
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            disabled={disabled}
            title={copied ? "Copied to clipboard" : (title ?? "Click to copy command")}
            className={cn(
                "group inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                copied
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border/70 bg-muted/40 text-foreground hover:border-border hover:bg-muted",
                className
            )}
        >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />}
            <span className="truncate">{command}</span>
            {!copied && <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
        </button>
    )
}
