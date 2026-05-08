import { useState } from "react"

import { Check, Copy } from "lucide-react"
import { CONFIG_DETAILS, ConfigType } from "terse-types"
import type {
    AgentTrigger,
    DatadogConfigData,
    FrequencyUnit,
    GitHubConfigData,
    GmailConfigData,
    HeyReachInputConfigData,
    LaunchDarklyConfigData,
    LinearInputConfigData,
    PosthogConfigData,
    SlackConfigData,
    TimeTriggerConfigData,
    WebMonitorConfigData,
    WorkOSInputConfigData
} from "terse-types"

import { getCronDescription } from "../../../components/ScheduleEditor"
import ToolCallParameters from "../../../components/ToolCallParameters"
import { useGithubIntegrations } from "../../../hooks/api/useGithubIntegrations"
import { useGithubResources } from "../../../hooks/api/useGithubResources"
import { useHeyReachCampaigns } from "../../../hooks/api/useHeyReachCampaigns"
import { useLinearTeams } from "../../../hooks/api/useLinearTeams"
import { useSlackUsers } from "../../../hooks/api/useSlackUsers"

import { IconForConfigType } from "./Integration"

export function TriggerDetailCard({ trigger }: { trigger: AgentTrigger }) {
    const { config } = trigger
    const type = config.configType
    const label = CONFIG_DETAILS[type as keyof typeof CONFIG_DETAILS]?.name ?? type

    switch (config.configType) {
        case ConfigType.WEBHOOK_INPUT:
            return <WebhookBody webhookUrl={trigger.metadata?.webhookUrl || undefined} label={label} type={type} />
        case ConfigType.WEBMONITOR:
            return <WebMonitorBody config={config} label={label} type={type} />
        case ConfigType.SLACK:
            return <SlackBody config={config} label={label} type={type} />
        case ConfigType.GITHUB: {
            const normalizedConfig: GitHubConfigData = {
                ...config,
                eventTypes: "eventTypes" in config ? (config.eventTypes ?? null) : null
            }
            return <GitHubBody config={normalizedConfig} label={label} type={type} />
        }
        case ConfigType.LINEAR_INPUT:
            return <LinearBody config={config} label={label} type={type} />
        case ConfigType.GMAIL:
            return <GmailBody config={config} label={label} type={type} />
        case ConfigType.TIME_TRIGGER:
            return <TimeBody config={config} label={label} type={type} />
        case ConfigType.WORKOS_INPUT:
            return <WorkOSBody config={config} label={label} type={type} />
        case ConfigType.POSTHOG:
            return <PosthogBody config={config} label={label} type={type} />
        case ConfigType.DATADOG:
            return <DatadogBody config={config} label={label} type={type} />
        case ConfigType.LAUNCHDARKLY:
            return <LaunchDarklyBody config={config} label={label} type={type} />
        case ConfigType.HEY_REACH_INPUT:
            return <HeyReachBody config={config} label={label} type={type} />
        default:
            return <Frame type={type} label={label} />
    }
}

function WebhookBody({ webhookUrl, label, type }: { webhookUrl: string | undefined; label: string; type: ConfigType }) {
    const curlCommand = webhookUrl ? `curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"hello": "world"}'` : null

    return (
        <Frame type={type} label={label} summary="POST">
            {webhookUrl ? (
                <>
                    <Field label="URL">
                        <div className="flex items-start gap-2">
                            <code className="bg-muted/60 text-foreground flex-1 rounded-md px-2.5 py-2 font-mono text-xs leading-relaxed break-all select-all">{webhookUrl}</code>
                            <CopyButton text={webhookUrl} />
                        </div>
                    </Field>
                    {curlCommand ? (
                        <Field label="Example">
                            <div className="flex items-start gap-2">
                                <pre className="bg-muted/60 text-foreground flex-1 overflow-x-auto rounded-md px-2.5 py-2 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                                    {curlCommand}
                                </pre>
                                <CopyButton text={curlCommand} />
                            </div>
                        </Field>
                    ) : null}
                    <p className="text-muted-foreground text-xs leading-relaxed">Send a POST request to this URL to trigger the job. The request body is delivered as the event payload.</p>
                </>
            ) : (
                <EmptyValue text="Webhook URL unavailable" />
            )}
        </Frame>
    )
}

function WebMonitorBody({ config, label, type }: { config: WebMonitorConfigData; label: string; type: ConfigType }) {
    const hasSchema = !!config.outputSchema
    const schemaJson = hasSchema
        ? JSON.stringify({
              ...(config.outputSchema?.jsonSchema.properties ? { properties: config.outputSchema.jsonSchema.properties } : {}),
              ...(config.outputSchema?.jsonSchema.required ? { required: config.outputSchema.jsonSchema.required } : {})
          })
        : null

    return (
        <Frame type={type} label={label} summary={formatFrequency(config.frequency)}>
            <Field label="Query">
                <p className="text-foreground text-sm leading-relaxed break-words">{config.query}</p>
            </Field>
            {schemaJson ? (
                <Field label="Structured output">
                    <ToolCallParameters parameters={schemaJson} label="Structured output" collapsed={true} />
                </Field>
            ) : null}
        </Frame>
    )
}

function SlackBody({ config, label, type }: { config: SlackConfigData; label: string; type: ConfigType }) {
    const { users } = useSlackUsers(config.integrationId)
    const target = config.channelName ? `#${config.channelName}` : config.channelId ? config.channelId : config.listenToUserDms ? "Direct messages" : null
    const eventTypes = config.eventTypes ?? []
    const userIds = config.userIds ?? []
    const userNames = userIds.map(id => users.find(u => u.id === id)?.name ?? id)

    return (
        <Frame type={type} label={label} summary={target ?? undefined}>
            {target ? <Field label={config.channelName || config.channelId ? "Channel" : "Source"}>{target}</Field> : null}
            {userIds.length > 0 ? (
                <Field label="Users">
                    <Chips items={userNames} />
                </Field>
            ) : null}
            {eventTypes.length > 0 ? (
                <Field label="Events">
                    <Chips items={eventTypes.map(formatSlackEvent)} />
                </Field>
            ) : null}
        </Frame>
    )
}

function GitHubBody({ config, label, type }: { config: GitHubConfigData; label: string; type: ConfigType }) {
    const { integrations } = useGithubIntegrations()
    const installationId = integrations.find(i => i.id === config.integrationId)?.installation_id ?? null
    const { repositories } = useGithubResources(installationId)

    const repoIds = config.repositoryIds ?? []
    const repoLabels = repoIds.map(id => {
        const repo = repositories.find(r => r.id === id)
        return repo ? `${repo.owner}/${repo.name}` : `#${id}`
    })
    const events = config.eventTypes ?? []

    return (
        <Frame type={type} label={label} summary={repoIds.length > 0 ? `${repoIds.length} ${repoIds.length === 1 ? "repo" : "repos"}` : undefined}>
            {repoIds.length > 0 ? (
                <Field label="Repositories">
                    <Chips items={repoLabels} mono />
                </Field>
            ) : null}
            {events.length > 0 ? (
                <Field label="Events">
                    <Chips items={events.map(formatGitHubEvent)} />
                </Field>
            ) : null}
        </Frame>
    )
}

function LinearBody({ config, label, type }: { config: LinearInputConfigData; label: string; type: ConfigType }) {
    const { teams } = useLinearTeams(config.integrationId)
    const team = config.teamId ? teams.find(t => t.id === config.teamId) : null
    const teamLabel = team ? (team.key ? `${team.name} (${team.key})` : team.name) : config.teamId
    const events = config.eventTypes ?? []

    return (
        <Frame type={type} label={label} summary={team?.name ?? undefined}>
            {config.teamId ? <Field label="Team">{teamLabel}</Field> : null}
            {config.projectId ? (
                <Field label="Project">
                    <code className="bg-muted/60 text-foreground inline-block rounded-md px-2 py-0.5 font-mono text-xs">{config.projectId}</code>
                </Field>
            ) : null}
            {events.length > 0 ? (
                <Field label="Events">
                    <Chips items={events.map(formatLinearEvent)} />
                </Field>
            ) : null}
        </Frame>
    )
}

function GmailBody({ config, label, type }: { config: GmailConfigData; label: string; type: ConfigType }) {
    const events = config.eventTypes ?? []
    return (
        <Frame type={type} label={label} summary={events.length > 0 ? formatGmailEvent(events[0]) : undefined}>
            {events.length > 0 ? (
                <Field label="Events">
                    <Chips items={events.map(formatGmailEvent)} />
                </Field>
            ) : null}
        </Frame>
    )
}

function TimeBody({ config, label, type }: { config: TimeTriggerConfigData; label: string; type: ConfigType }) {
    const description = config.cronExpression ? safeCronDescription(config.cronExpression) : null
    return (
        <Frame type={type} label={label} summary={description ?? undefined}>
            <Field label="Schedule (UTC)">
                <code className="bg-muted/60 text-foreground inline-block rounded-md px-2 py-1 font-mono text-xs">{config.cronExpression}</code>
            </Field>
        </Frame>
    )
}

function WorkOSBody({ config, label, type }: { config: WorkOSInputConfigData; label: string; type: ConfigType }) {
    const events = config.eventTypes ?? []
    return (
        <Frame type={type} label={label} summary={events.length > 0 ? `${events.length} ${events.length === 1 ? "event" : "events"}` : undefined}>
            {events.length > 0 ? (
                <Field label="Events">
                    <Chips items={events.map(e => e)} />
                </Field>
            ) : null}
        </Frame>
    )
}

function PosthogBody({ config, label, type }: { config: PosthogConfigData; label: string; type: ConfigType }) {
    return (
        <Frame type={type} label={label} summary={config.projectName ?? undefined}>
            <Field label="Project">{config.projectName ?? config.projectId}</Field>
        </Frame>
    )
}

function DatadogBody({ config, label, type }: { config: DatadogConfigData; label: string; type: ConfigType }) {
    const indexes = config.defaultIndexes ?? []
    return (
        <Frame type={type} label={label}>
            {indexes.length > 0 ? (
                <Field label="Default indexes">
                    <Chips items={indexes} mono />
                </Field>
            ) : null}
        </Frame>
    )
}

function HeyReachBody({ config, label, type }: { config: HeyReachInputConfigData; label: string; type: ConfigType }) {
    const { campaigns } = useHeyReachCampaigns(config.integrationId)
    const campaignIds = config.campaignIds ?? []
    const campaignLabels = campaignIds.map(id => campaigns.find(c => c.id === id)?.name ?? id)

    return (
        <Frame type={type} label={label}>
            <Field label="Event">
                <Chips items={[formatHeyReachEvent(config.eventType)]} />
            </Field>
            <Field label="Campaigns">{campaignIds.length > 0 ? <Chips items={campaignLabels} /> : <span className="text-muted-foreground text-xs">All campaigns</span>}</Field>
        </Frame>
    )
}

function LaunchDarklyBody({ config, label, type }: { config: LaunchDarklyConfigData; label: string; type: ConfigType }) {
    return (
        <Frame type={type} label={label} summary={config.projectKey}>
            <Field label="Project">
                <code className="bg-muted/60 text-foreground inline-block rounded-md px-2 py-0.5 font-mono text-xs">{config.projectKey}</code>
            </Field>
            {config.environmentKeys.length > 0 ? (
                <Field label="Environments">
                    <Chips items={config.environmentKeys} mono />
                </Field>
            ) : null}
        </Frame>
    )
}

function Frame({ type, label, summary, children }: { type: ConfigType; label: string; summary?: string; children?: React.ReactNode }) {
    const hasBody = !!children
    return (
        <div className="border-border/60 bg-card overflow-hidden rounded-lg border">
            <div className={`bg-muted/30 flex items-center gap-2.5 px-4 ${hasBody ? "border-border/60 border-b py-2.5" : "py-3"}`}>
                <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <IconForConfigType type={type} />
                </div>
                <span className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">{label}</span>
                {summary ? (
                    <span className="text-foreground ml-auto truncate text-xs font-medium tabular-nums" title={summary}>
                        {summary}
                    </span>
                ) : null}
            </div>
            {hasBody ? <div className="space-y-3 px-4 py-3.5">{children}</div> : null}
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">{label}</div>
            <div className="text-foreground text-sm leading-relaxed">{children}</div>
        </div>
    )
}

function Chips({ items, mono = false }: { items: string[]; mono?: boolean }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item, i) => (
                <span key={`${item}-${i}`} className={`bg-muted/60 text-foreground rounded-md px-1.5 py-0.5 text-xs ${mono ? "font-mono" : "font-medium"}`}>
                    {item}
                </span>
            ))}
        </div>
    )
}

function EmptyValue({ text }: { text: string }) {
    return <p className="text-muted-foreground text-xs">{text}</p>
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button onClick={handleCopy} className="hover:bg-muted/80 mt-0.5 shrink-0 rounded-md p-1.5 transition-colors" aria-label="Copy to clipboard">
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="text-muted-foreground size-3.5" />}
        </button>
    )
}

function formatFrequency(frequency: { number: number; unit: FrequencyUnit }): string {
    const amount = Math.max(1, frequency.number)
    return amount === 1 ? `Every ${frequency.unit}` : `Every ${amount} ${frequency.unit}s`
}

function safeCronDescription(expression: string): string | null {
    try {
        const description = getCronDescription(expression)
        if (!description || description === "No schedule configured") return null
        return description
    } catch {
        return null
    }
}

function formatSlackEvent(type: string): string {
    if (type === "message") return "Message"
    if (type === "app_mention") return "App mention"
    if (type === "reaction_added") return "Reaction added"
    return type
}

function formatGitHubEvent(type: string): string {
    if (type === "push") return "Push"
    if (type === "pull_request.opened") return "PR opened"
    if (type === "pull_request.merged") return "PR merged"
    if (type === "pull_request.closed") return "PR closed"
    if (type === "pull_request.synchronize") return "PR updated"
    return type
}

function formatLinearEvent(type: string): string {
    if (type === "issue.created") return "Issue created"
    if (type === "issue.updated") return "Issue updated"
    if (type === "comment.created") return "Comment added"
    return type
}

function formatGmailEvent(type: string): string {
    if (type === "email.received") return "Email received"
    return type
}

function formatHeyReachEvent(type: string): string {
    switch (type) {
        case "CONNECTION_REQUEST_SENT":
            return "Connection request sent"
        case "CONNECTION_REQUEST_ACCEPTED":
            return "Connection accepted"
        case "MESSAGE_SENT":
            return "Message sent"
        case "MESSAGE_REPLY_RECEIVED":
            return "Message reply"
        case "INMAIL_SENT":
            return "InMail sent"
        case "INMAIL_REPLY_RECEIVED":
            return "InMail reply"
        case "FOLLOW_SENT":
            return "Follow sent"
        case "LIKED_POST":
            return "Post liked"
        case "VIEWED_PROFILE":
            return "Profile viewed"
        case "CAMPAIGN_COMPLETED":
            return "Campaign completed"
        case "LEAD_TAG_UPDATED":
            return "Lead tag updated"
        default:
            return type
    }
}
