function AwaitingResponseAnimation() {
    return (
        <div className="flex h-8 items-center gap-2.5 text-sm text-muted-foreground" role="status" aria-live="polite">
            <span className="sr-only">Waiting for a response…</span>
            <div className="flex items-center gap-1" aria-hidden="true">
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "140ms" }} />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "280ms" }} />
            </div>
            <span aria-hidden="true">Working…</span>
        </div>
    )
}

export { AwaitingResponseAnimation }
