import apiRoutes from "./ApiRoutes.json" with { type: "json" };
export const ApiRoutes = apiRoutes;
export function buildApiRoute(pattern, params) {
    return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, paramName) => {
        const value = params[paramName];
        if (value == null) {
            throw new Error(`Missing route param: ${paramName}`);
        }
        return encodeURIComponent(String(value));
    });
}
