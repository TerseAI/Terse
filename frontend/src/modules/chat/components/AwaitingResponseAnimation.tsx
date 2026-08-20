function AwaitingResponseAnimation() {
    return (
        <div className="flex h-8 items-center gap-1.5 text-sm text-muted-foreground" role="status" aria-live="polite">
            <span className="sr-only">Waiting for a response…</span>
            <div className="flex w-3.5 shrink-0 items-center justify-center gap-px" aria-hidden="true">
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "140ms" }} />
                <span className="size-1 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "280ms" }} />
            </div>
            <span aria-hidden="true">Working…</span>
        </div>
    )
}

export { AwaitingResponseAnimation }
