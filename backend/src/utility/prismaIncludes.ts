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
    } as const;
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
        figma_config: true,
    } as const;
}

/**
 * Returns the include object for channel knowledge base configs.
 */
export function getKnowledgeBaseConfigInclude() {
    return {
        posthog_config: true,
        github_kb_config: true,
    } as const;
}