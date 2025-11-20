/**
 * Returns the include object for automation input configs.
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
 * Returns the include object for automation output configs.
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