/**
 * The phases a tool call can be in for display purposes.
 */
export type ToolDisplayPhase = "preparing" | "executing" | "complete" | "approval";
/**
 * Safely parse JSON parameters string into an object.
 */
export declare function parseToolParams(parametersJson?: string): Record<string, unknown> | undefined;
/**
 * Get display string for a tool call based on its current phase.
 *
 * @param toolName - The internal tool name (e.g., 'linear_create_ticket')
 * @param phase - The current phase: 'preparing', 'executing', or 'complete'
 * @param options - Optional params, integration, and result for dynamic display
 * @returns Human-readable display string
 *
 * @example
 * getToolDisplayForPhase('fetchResourcesForIntegration', 'executing', { params: { integrationType: 'notion' } })
 * // Returns: "Fetching resources from Notion"
 */
export declare function getToolDisplayForPhase(toolName: string, phase: ToolDisplayPhase, options?: {
    params?: Record<string, unknown>;
    result?: string;
}): string;
export declare function getReadableFallbackName(toolName: string): string;
/**
 * Convenience function that parses parameters JSON and gets the display string.
 */
export declare function getToolDisplayFromCall(toolName: string, phase: ToolDisplayPhase, parametersJson?: string, result?: string): string;
