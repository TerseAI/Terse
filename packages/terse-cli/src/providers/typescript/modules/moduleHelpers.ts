import type { ToolDefinition } from "terse-types"

export function toPascalCase(value: string): string {
    return value
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
}

export function toCamelCase(value: string): string {
    const pascal = toPascalCase(value)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function escapeString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function toGeneratedIdentifier(raw: string, fallback: string): string {
    let name = toPascalCase(raw || fallback)
    if (!name) name = fallback
    if (/^\d/.test(name)) name = `_${name}`
    return name
}

export function toolNameToTypeName(name: string, suffix: "Params" | "Result"): string {
    return (
        name
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join("") + suffix
    )
}

export function renderStringLiteralUnion(values: string[]): string {
    if (values.length === 0) return "never"
    return values.map(value => `"${escapeString(value)}"`).join(" | ")
}

export function buildSkillToolType(tools: readonly ToolDefinition[]): string {
    const toolNames = tools
        .filter(tool => !tool.isReadOnly || tool.supportsApproval)
        .map(tool => tool.name)
        .sort()

    return renderStringLiteralUnion(toolNames)
}

export function buildResourceClassContext(className: string, fields: ResourceFieldMapping[], staticNameField: string, items: object[]): ResourceClassContext {
    const constructorParams = fields.map(field => `public readonly ${field.classField}: ${field.type}`).join(", ")

    const entries: ResourceClassContext["items"] = []
    const usedNames = new Set<string>()

    for (const item of items) {
        const source = item as Record<string, unknown>
        let name = toPascalCase(String(source[staticNameField] || "Unknown"))
        if (!name || /^\d/.test(name)) name = `_${name}`
        while (usedNames.has(name)) name += "_"
        usedNames.add(name)

        const argsText = fields
            .map(field => {
                const value = source[field.sourceField]
                if (typeof value === "number") return String(value)
                return `"${escapeString(String(value ?? ""))}"`
            })
            .join(", ")

        entries.push({
            staticName: name,
            argsText
        })
    }

    return {
        className,
        constructorParams,
        items: entries
    }
}

export interface ResourceFieldMapping {
    classField: string
    type: string
    sourceField: string
}

export interface ResourceClassContext {
    className: string
    constructorParams: string
    items: Array<{
        staticName: string
        argsText: string
    }>
}
