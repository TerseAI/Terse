/**
 * Returns the include object for channel input configs.
 * Can be extended or spread for custom queries (e.g., groupBy).
 */
export function getInputConfigInclude() {
    return {
        slack_config: true,
        notion_config: true,
        notion_page_config: true,
        linear_config: true,
        jira_config: true,
        confluence_config: true,
        github_config: true,
        gmail_config: true,
        figma_config: true,
        time_trigger_config: true
    } as const
}

/**
 * Returns the include object for channel output configs.
 * Can be extended or spread for custom queries (e.g., groupBy).
 */
export function getOutputConfigInclude() {
    return {
        slack_config: true,
        notion_config: true,
        notion_page_config: true,
        linear_config: true,
        jira_config: true,
        confluence_config: true,
        github_config: true,
        gmail_config: true,
        figma_config: true
    } as const
}

/**
 * Returns the include object for channel knowledge base configs.
 */
export function getKnowledgeBaseConfigInclude() {
    return {
        posthog_config: true,
        github_kb_config: true,
        launchdarkly_config: true,
        datadog_config: true
    } as const
}

/**
 * Returns the full include object for hydrating an agent with all relations.
 * Use this when fetching agents that need their full configuration (inputs, outputs, knowledge bases, etc.)
 */
export function getAgentHydrationInclude() {
    return {
        prompt: true,
        inputs: {
            include: getInputConfigInclude()
        },
        outputs: {
            include: getOutputConfigInclude()
        },
        knowledge_bases: {
            include: getKnowledgeBaseConfigInclude()
        },
        tool_approvals: true
    } as const
}
