import { capitalize } from "@/lib/utils"
import { IntegrationType } from "@/shared/Integrations"

// Helper function to parse tool name and extract integration/action info
export function parseToolInfo(
    toolName: string,
    parameters: string,
    integration?: string
): {
    integration: IntegrationType | null
    action: string
    target: string
    details: string
} {
    // Use integration from event directly, no need to infer
    let integrationType: IntegrationType | null = null
    if (integration) {
        // Map string to IntegrationType enum
        integrationType = integration as IntegrationType
    }

    let action = toolName
    let target = ""
    let details = parameters

    // Format action name (convert "Create Ticket" to "create_ticket" style, then format)
    const formatAction = (s: string) => {
        return s
            .split(/(?=[A-Z])/)
            .map(word => word.toLowerCase())
            .join("_")
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
    }

    action = formatAction(toolName)

    // Remove integration prefix from action name if it exists (e.g., "Notion Query Page" -> "Query Page")
    // This avoids redundant display like "Notion Query Page on Notion"
    if (integrationType && action) {
        const integrationName = capitalize(integrationType)
        // Check if action starts with the integration name
        if (action.toLowerCase().startsWith(integrationName.toLowerCase() + " ")) {
            action = action.substring(integrationName.length + 1).trim()
        }
        // Also handle cases like "notion_query_page" -> "notion Query Page" after formatting
        const actionWords = action.split(" ")
        if (actionWords.length > 1 && actionWords[0].toLowerCase() === integrationName.toLowerCase()) {
            action = actionWords.slice(1).join(" ")
        }
    }

    return { integration: integrationType, action, target, details }
}
