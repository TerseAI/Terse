function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Zod 4 embeds non-JSON Schema metadata under "~*" keys (for example "~standard").
 * Strip those keys recursively before passing schemas to model providers.
 */
export function stripZodJsonSchemaMetadata(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => stripZodJsonSchemaMetadata(item))
    }

    if (!isPlainObject(value)) {
        return value
    }

    const cleaned: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
        if (key.startsWith("~")) {
            continue
        }
        cleaned[key] = stripZodJsonSchemaMetadata(nestedValue)
    }
    return cleaned
}
