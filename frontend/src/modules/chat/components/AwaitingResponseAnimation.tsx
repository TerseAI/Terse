function AwaitingResponseAnimation() {
    return (
        <div className="my-2 flex justify-start" role="status" aria-live="polite">
            <span className="sr-only">Waiting for a response…</span>
            <div className="rounded-md py-2" aria-hidden="true">
                <div className="flex items-center space-x-1.5">
                    <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                    <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "120ms" }} />
                    <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: "240ms" }} />
                </div>
            </div>
        </div>
    )
}

export { AwaitingResponseAnimation }
