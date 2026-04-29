const wholeUsdFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
})

const preciseUsdFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})

export function formatCredits(value: number): string {
    return value.toLocaleString()
}

export function formatUsd(value: number): string {
    return wholeUsdFormatter.format(value)
}

export function formatUsdPrecise(value: number): string {
    return preciseUsdFormatter.format(value)
}
