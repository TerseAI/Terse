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
    return Math.floor(value).toLocaleString()
}

export function formatUsd(value: number): string {
    return wholeUsdFormatter.format(value)
}

export function formatUsdPrecise(value: number): string {
    return preciseUsdFormatter.format(value)
}

/** Dollars billed per 1,000 credits from backend `overageCentsPerCredit` (cents per credit, may be fractional). */
export function formatUsdPerThousandCredits(centsPerCredit: number): string {
    const dollarsPerThousand = (centsPerCredit / 100) * 1000
    return preciseUsdFormatter.format(dollarsPerThousand)
}
