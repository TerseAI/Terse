type Props = {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
}

export default function RunHistoryPagination({ currentPage, totalPages, onPageChange }: Props) {
    if (totalPages <= 1) {
        return null
    }

    const pages: (number | string)[] = []
    const maxPagesToShow = 7

    if (totalPages <= maxPagesToShow) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i)
        }
    } else {
        // Always show first page
        pages.push(1)

        if (currentPage > 3) {
            pages.push("…")
        }

        // Show pages around current page
        const start = Math.max(2, currentPage - 1)
        const end = Math.min(totalPages - 1, currentPage + 1)

        for (let i = start; i <= end; i++) {
            pages.push(i)
        }

        if (currentPage < totalPages - 2) {
            pages.push("…")
        }

        // Always show last page
        pages.push(totalPages)
    }

    return (
        <nav aria-label="Pagination" className="flex items-center gap-1">
            {pages.map((page, index) => {
                const isEllipsis = page === "…"
                const isCurrent = page === currentPage

                return (
                    <button
                        key={index}
                        className={`h-9 min-w-9 px-3 rounded-md border text-sm transition-colors max-md:h-11 max-md:min-w-11 ${
                            isCurrent ? "border-primary bg-primary text-primary-foreground" : "border-border text-accent-foreground hover:text-foreground hover:bg-accent"
                        } ${isEllipsis ? "cursor-default hover:bg-transparent" : ""}`}
                        onClick={() => typeof page === "number" && onPageChange(page)}
                        disabled={isEllipsis || isCurrent}
                        type="button"
                        aria-label={isEllipsis ? "More pages" : `Page ${page}`}
                        aria-current={isCurrent ? "page" : undefined}
                    >
                        {page}
                    </button>
                )
            })}
        </nav>
    )
}
