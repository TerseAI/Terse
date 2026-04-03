import apiRoutes from "./ApiRoutes.json" with { type: "json" }

export const ApiRoutes = apiRoutes

export function buildRoute(pattern: string, params: Record<string, string | number>): string {
    return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, paramName: string) => {
        const value = params[paramName]

        if (value == null) {
            throw new Error(`Missing route param: ${paramName}`)
        }

        return encodeURIComponent(String(value))
    })
}
