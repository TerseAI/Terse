import { useState } from "react"

import { ChevronRightIcon } from "@heroicons/react/24/outline"

import { cn } from "@/lib/utils"

interface ToolCallParametersProps {
    parameters: string
    label?: string
}

/** Format a single value for display */
function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    return JSON.stringify(value, null, 2)
}

/** Check if a value is a complex type (object/array) that needs special rendering */
function isComplex(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (Array.isArray(value)) return value.length > 0 && typeof value[0] === "object"
    return typeof value === "object"
}

/** Check if a value should be hidden (null, undefined, or empty) */
function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === "string" && value.trim() === "") return true
    if (Array.isArray(value) && value.length === 0) return true
    if (typeof value === "object" && Object.keys(value as object).length === 0) return true
    return false
}

/** Render a simple array as inline comma-separated values */
function SimpleArrayDisplay({ items }: { items: unknown[] }) {
    return (
        <span className="text-foreground">
            {items.map((item, i) => (
                <span key={i}>
                    {i > 0 && <span className="text-muted-foreground">, </span>}
                    {formatValue(item)}
                </span>
            ))}
        </span>
    )
}

/** Collapsible section for complex nested values */
function CollapsibleValue({ label, value }: { label: string; value: unknown }) {
    const [isOpen, setIsOpen] = useState(false)
    const preview = Array.isArray(value) ? `[${(value as unknown[]).length} items]` : typeof value === "object" ? `{${Object.keys(value as object).length} fields}` : ""

    return (
        <div>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRightIcon className={cn("w-3 h-3 transition-transform", isOpen && "rotate-90")} />
                <span className="font-mono text-xs">{label}</span>
                <span className="text-xs text-muted-foreground/60">{preview}</span>
            </button>
            {isOpen && <pre className="mt-1 ml-4 text-xs text-foreground/80 whitespace-pre-wrap font-mono select-text">{JSON.stringify(value, null, 2)}</pre>}
        </div>
    )
}

/** Render a key-value pair */
function KeyValueRow({ label, value }: { label: string; value: unknown }) {
    // Skip empty values
    if (isEmptyValue(value)) return null

    // Simple arrays (strings, numbers) shown inline
    if (Array.isArray(value) && value.length > 0 && !isComplex(value)) {
        return (
            <div className="flex gap-3 text-xs leading-relaxed">
                <span className="font-mono text-muted-foreground/70 shrink-0 min-w-[80px]">{label}</span>
                <SimpleArrayDisplay items={value} />
            </div>
        )
    }

    // Complex objects/arrays get a collapsible section
    if (isComplex(value)) {
        return <CollapsibleValue label={label} value={value} />
    }

    // Long strings get wrapped
    const formatted = formatValue(value)
    const isLong = formatted.length > 80

    return (
        <div className={cn("flex gap-3 text-xs leading-relaxed", isLong && "flex-col gap-0.5")}>
            <span className="font-mono text-muted-foreground/70 shrink-0 min-w-[80px]">{label}</span>
            <span className={cn("text-foreground select-text", isLong && "ml-0 break-words")}>{formatted}</span>
        </div>
    )
}

const ToolCallParameters = ({ parameters, label }: ToolCallParametersProps) => {
    let parsed: unknown
    try {
        parsed = JSON.parse(parameters)
    } catch {
        return <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono select-text">{parameters}</pre>
    }

    // Non-object values (string, number, etc.)
    if (typeof parsed !== "object" || parsed === null) {
        return <pre className="text-xs text-foreground whitespace-pre-wrap font-mono select-text">{String(parsed)}</pre>
    }

    // Empty object
    const entries = Object.entries(parsed as Record<string, unknown>).filter(([, v]) => !isEmptyValue(v))
    if (entries.length === 0) return null

    return (
        <div className="space-y-1.5">
            {label && <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">{label}</div>}
            <div className="space-y-1">
                {entries.map(([key, value]) => (
                    <KeyValueRow key={key} label={key} value={value} />
                ))}
            </div>
        </div>
    )
}

export default ToolCallParameters
