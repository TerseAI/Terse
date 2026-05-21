const wholeUsdFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
})

export function formatCredits(value: number): string {
    return Math.floor(value).toLocaleString()
}

export function formatUsd(value: number): string {
    return wholeUsdFormatter.format(value)
}
