import JsonView from "@uiw/react-json-view"

interface ToolCallParametersProps {
    parameters: string
    label?: string
}

/** Theme derived from ShadCN CSS variables — automatically respects light/dark mode */
const theme = {
    "--w-rjv-background-color": "transparent",
    "--w-rjv-border-left": "1px solid var(--border)",
    "--w-rjv-color": "var(--foreground)",
    "--w-rjv-key-string": "var(--muted-foreground)",
    "--w-rjv-info-color": "var(--muted-foreground)",
    "--w-rjv-type-string-color": "var(--accent-primary)",
    "--w-rjv-type-int-color": "var(--accent-secondary)",
    "--w-rjv-type-float-color": "var(--accent-secondary)",
    "--w-rjv-type-boolean-color": "var(--accent-tertiary)",
    "--w-rjv-type-null-color": "var(--muted-foreground)",
    "--w-rjv-curlybraces-color": "var(--muted-foreground)",
    "--w-rjv-brackets-color": "var(--muted-foreground)",
    "--w-rjv-colon-color": "var(--muted-foreground)"
} as React.CSSProperties

const ToolCallParameters = ({ parameters, label }: ToolCallParametersProps) => {
    let parsed: object
    try {
        const value = JSON.parse(parameters)
        // Wrap non-object values so the viewer can render them
        if (typeof value !== "object" || value === null) {
            parsed = { value }
        } else {
            parsed = value
        }
    } catch {
        return <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono select-text">{parameters}</pre>
    }

    // Skip empty objects
    if (typeof parsed === "object" && Object.keys(parsed).length === 0) {
        return null
    }

    return (
        <div className="space-y-1">
            {label && <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">{label}</div>}
            <JsonView value={parsed} style={theme} shortenTextAfterLength={80} collapsed={2} displayDataTypes={false} displayObjectSize={false} enableClipboard={false} />
        </div>
    )
}

export default ToolCallParameters
