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
            pages.push("...")
        }

        // Show pages around current page
        const start = Math.max(2, currentPage - 1)
        const end = Math.min(totalPages - 1, currentPage + 1)

        for (let i = start; i <= end; i++) {
            pages.push(i)
        }

        if (currentPage < totalPages - 2) {
            pages.push("...")
        }

        // Always show last page
        pages.push(totalPages)
    }

    return (
        <div className="flex items-center gap-1">
            {pages.map((page, index) => (
                <button
                    key={index}
                    className={`h-9 px-3 rounded-md border text-sm transition-colors ${
                        page === currentPage
                            ? "border-[var(--color-primary)] text-primary-foreground]"
                            : "border-[theme(border)] text-accent-foreground hover:text-[theme(text-primary)] hover:bg-[theme(background-hover)]"
                    } ${page === "..." ? "cursor-default hover:bg-transparent hover:text-[theme(text-secondary)]" : ""}`}
                    onClick={() => typeof page === "number" && onPageChange(page)}
                    disabled={page === "..." || page === currentPage}
                    type="button"
                >
                    {page}
                </button>
            ))}
        </div>
    )
}
