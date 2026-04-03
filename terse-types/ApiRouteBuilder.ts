export { ApiRoutes } from "./ApiRoutes.generated"

export type RouteParamValue = string | number

type ExtractParamName<T extends string> = T extends `${infer Param}/${string}` ? Param : T extends `${infer Param}?${string}` ? Param : T extends `${infer Param}&${string}` ? Param : T

type ExtractRemainingPath<T extends string> = T extends `${string}/${infer Rest}` ? Rest : T extends `${string}?${infer Rest}` ? Rest : T extends `${string}&${infer Rest}` ? Rest : ""

type RouteParamKeysInternal<T extends string> = T extends `${string}:${infer Rest}` ? ExtractParamName<Rest> | RouteParamKeysInternal<ExtractRemainingPath<Rest>> : never

export type RouteParamKeys<T extends string> = string extends T ? string : RouteParamKeysInternal<T>

export type RouteParams<T extends string> = string extends T
    ? Record<string, RouteParamValue>
    : [RouteParamKeysInternal<T>] extends [never]
      ? Record<string, never>
      : { [K in RouteParamKeysInternal<T>]: RouteParamValue }

export function buildRoute<T extends string>(pattern: T, params: RouteParams<T>): string {
    return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, paramName: string) => {
        const value = params[paramName as keyof typeof params]

        if (value == null) {
            throw new Error(`Missing route param: ${paramName}`)
        }

        return encodeURIComponent(String(value))
    })
}
