export function getInputConfigInclude() {
    return {
        slack_config: true,
        notion_config: true,
        linear_config: true,
        github_config: true,
        gmail_config: true,
        time_trigger_config: true,
        workos_config: true,
        attio_input_config: true,
        webhook_config: true,
        webmonitor_config: true,
        hey_reach_config: true
    } as const
}

export function getOutputConfigInclude() {
    return {
        slack_config: true,
        notion_config: true,
        linear_config: true,
        github_config: true,
        gmail_config: true,
        posthog_config: true,
        datadog_config: true,
        launchdarkly_config: true,
        workos_output_config: true,
        attio_config: true,
        snowflake_config: true,
        resend_config: true
    } as const
}
