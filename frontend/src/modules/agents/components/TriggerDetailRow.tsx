import { useState } from "react"

import { Check, Copy } from "lucide-react"
import { CONFIG_DETAILS, ConfigType } from "terse-types"
import type {
    AgentTrigger,
    AttioFilter,
    AttioInputConfigData,
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

import { describeCron, formatNextRun, getNextRun } from "@/lib/cron"
import { useAttioObjects } from "@/modules/integrations/api/useAttioObjects"
import { useGithubIntegrations } from "@/modules/integrations/api/useGithubIntegrations"
import { useGithubResources } from "@/modules/integrations/api/useGithubResources"
import { useHeyReachCampaigns } from "@/modules/integrations/api/useHeyReachCampaigns"
import { useLinearTeams } from "@/modules/integrations/api/useLinearTeams"
import { useSlackUsers } from "@/modules/integrations/api/useSlackUsers"
import { getUserTimezone } from "@/utils/timezone"

import { IconForConfigType } from "./Integration"

export function TriggerDetailRow({ trigger }: { trigger: AgentTrigger }) {
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
        case ConfigType.ATTIO_INPUT:
            return <AttioBody config={config} label={label} type={type} />
        default:
            return <Frame type={type} label={label} />
    }
}

function WebhookBody({ webhookUrl, label, type }: { webhookUrl: string | undefined; label: string; type: ConfigType }) {
    if (!webhookUrl) {
        return <Frame type={type} label={label} meta={<EmptyValue text="Webhook URL unavailable" />} />
    }

    return (
        <Frame
            type={type}
            label={label}
            meta={
                <>
                    <code className="bg-muted/60 text-foreground min-w-0 truncate rounded-md px-1.5 py-0.5 font-mono text-xs select-all" title={webhookUrl}>
                        {webhookUrl}
                    </code>
                    <CopyButton text={webhookUrl} />
                </>
            }
            summary="POST"
        />
    )
}

function WebMonitorBody({ config, label, type }: { config: WebMonitorConfigData; label: string; type: ConfigType }) {
    return (
        <Frame
            type={type}
            label={label}
            meta={
                <span className="text-foreground min-w-0 truncate text-xs leading-none" title={config.query}>
                    {config.query}
                </span>
            }
            summary={joinSummary(formatFrequency(config.frequency), config.outputSchema ? "Structured output" : null)}
        />
    )
}

function SlackBody({ config, label, type }: { config: SlackConfigData; label: string; type: ConfigType }) {
    const { users } = useSlackUsers(config.integrationId)
    const target = config.channelName ? `#${config.channelName}` : config.channelId ? config.channelId : config.listenToUserDms ? "Direct messages" : null
    const eventTypes = config.eventTypes ?? []
    const userIds = config.userIds ?? []
    const userNames = userIds.map(id => users.find(u => u.id === id)?.name ?? id)

    return (
        <Frame
            type={type}
            label={label}
            meta={eventTypes.length > 0 ? <Chips items={eventTypes.map(formatSlackEvent)} max={3} /> : undefined}
            summary={joinSummary(target, describeList(userNames, "user"))}
        />
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
        <Frame type={type} label={label} meta={repoLabels.length > 0 ? <Chips items={repoLabels} mono max={2} /> : undefined} summary={joinSummary(events.map(formatGitHubEvent).join(", ") || null)} />
    )
}

function LinearBody({ config, label, type }: { config: LinearInputConfigData; label: string; type: ConfigType }) {
    const { teams } = useLinearTeams(config.integrationId)
    const team = config.teamId ? teams.find(t => t.id === config.teamId) : null
    const teamLabel = team ? (team.key ? `${team.name} (${team.key})` : team.name) : config.teamId
    const events = config.eventTypes ?? []

    return <Frame type={type} label={label} meta={teamLabel ? <Chips items={[teamLabel]} /> : undefined} summary={joinSummary(config.projectId, events.map(formatLinearEvent).join(", ") || null)} />
}

function GmailBody({ config, label, type }: { config: GmailConfigData; label: string; type: ConfigType }) {
    const events = config.eventTypes ?? []
    return <Frame type={type} label={label} meta={events.length > 0 ? <Chips items={events.map(formatGmailEvent)} max={3} /> : undefined} />
}

function TimeBody({ config, label, type }: { config: TimeTriggerConfigData; label: string; type: ConfigType }) {
    const timezone = config.timezone ?? "UTC"
    if (!config.cronExpression) {
        return <Frame type={type} label={label} meta={<EmptyValue text="No schedule configured" />} />
    }

    const nextRun = getNextRun(config.cronExpression, timezone)
    const description = describeCron(config.cronExpression)
    const anchoredDescription = description && timezone !== getUserTimezone() ? `${description} · ${timezone}` : description
    const schedule = (
        <>
            <code className="bg-muted/60 text-foreground shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs select-all">{config.cronExpression}</code>
            {anchoredDescription ? <span className="text-muted-foreground shrink-0 text-xs">{anchoredDescription}</span> : null}
            {!description && !nextRun ? <span className="text-muted-foreground shrink-0 text-xs">Unrecognized cron expression</span> : null}
        </>
    )

    return <Frame type={type} label={label} meta={schedule} summary={nextRun ? `Next run ${formatNextRun(nextRun)}` : undefined} />
}

function WorkOSBody({ config, label, type }: { config: WorkOSInputConfigData; label: string; type: ConfigType }) {
    const events = config.eventTypes ?? []
    return <Frame type={type} label={label} meta={events.length > 0 ? <Chips items={events} max={3} /> : undefined} />
}

function PosthogBody({ config, label, type }: { config: PosthogConfigData; label: string; type: ConfigType }) {
    return <Frame type={type} label={label} summary={config.projectName ?? config.projectId} />
}

function DatadogBody({ config, label, type }: { config: DatadogConfigData; label: string; type: ConfigType }) {
    const indexes = config.defaultIndexes ?? []
    return <Frame type={type} label={label} meta={indexes.length > 0 ? <Chips items={indexes} mono max={3} /> : undefined} />
}

function AttioBody({ config, label, type }: { config: AttioInputConfigData; label: string; type: ConfigType }) {
    const { objects } = useAttioObjects(config.integrationId)
    const subscriptions = config.subscriptions ?? []
    const objectNameById = new Map(objects.filter(o => o.id?.object_id).map(o => [o.id!.object_id, o.singular_noun || o.api_slug]))

    const subscriptionLabels = subscriptions.map(sub => {
        const parentObjectId = parentObjectIdFromFilter(sub.filter ?? null)
        const objectName = parentObjectId ? (objectNameById.get(parentObjectId) ?? parentObjectId) : null
        return objectName ? `${formatAttioEvent(sub.eventType)} on ${objectName}` : formatAttioEvent(sub.eventType)
    })

    if (subscriptionLabels.length === 0) {
        return <Frame type={type} label={label} meta={<EmptyValue text="No subscriptions" />} />
    }

    return <Frame type={type} label={label} meta={<Chips items={subscriptionLabels} max={2} />} />
}

function parentObjectIdFromFilter(filter: AttioFilter | null): string | null {
    if (!filter) return null
    const clauses = "$and" in filter ? filter.$and : filter.$or
    const match = clauses.find(c => (c.field === "id.object_id" || c.field === "parent_object_id") && c.operator === "equals")
    return typeof match?.value === "string" ? match.value : null
}

function HeyReachBody({ config, label, type }: { config: HeyReachInputConfigData; label: string; type: ConfigType }) {
    const { campaigns } = useHeyReachCampaigns(config.integrationId)
    const campaignIds = config.campaignIds ?? []
    const campaignLabels = campaignIds.map(id => campaigns.find(c => c.id === id)?.name ?? id)

    return (
        <Frame
            type={type}
            label={label}
            meta={<Chips items={[formatHeyReachEvent(config.eventType)]} />}
            summary={campaignLabels.length > 0 ? describeList(campaignLabels, "campaign") : "All campaigns"}
        />
    )
}

function LaunchDarklyBody({ config, label, type }: { config: LaunchDarklyConfigData; label: string; type: ConfigType }) {
    return <Frame type={type} label={label} meta={<Chips items={[config.projectKey]} mono />} summary={joinSummary(config.environmentKeys.join(", ") || null)} />
}

function Frame({ type, label, summary, meta }: { type: ConfigType; label: string; summary?: string; meta?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-x-2 overflow-hidden px-4 py-2.5">
            <div className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                <IconForConfigType type={type} />
            </div>
            <span className="text-foreground shrink-0 text-sm leading-none font-medium">{label}</span>
            {meta}
            {summary ? (
                <span className="text-muted-foreground ml-1 min-w-0 truncate text-xs leading-none tabular-nums" title={summary}>
                    {summary}
                </span>
            ) : null}
        </div>
    )
}

function Chips({ items, mono = false, max }: { items: string[]; mono?: boolean; max?: number }) {
    const shown = max ? items.slice(0, max) : items
    const hidden = items.length - shown.length

    return (
        <div className="flex shrink-0 items-center gap-1.5">
            {shown.map((item, i) => (
                <span key={`${item}-${i}`} className={`bg-muted/60 text-foreground rounded-md px-1.5 py-0.5 text-xs ${mono ? "font-mono" : "font-medium"}`}>
                    {item}
                </span>
            ))}
            {hidden > 0 ? (
                <span className="text-muted-foreground text-xs" title={items.slice(shown.length).join(", ")}>
                    +{hidden}
                </span>
            ) : null}
        </div>
    )
}

function EmptyValue({ text }: { text: string }) {
    return <div className="text-muted-foreground shrink-0 text-xs">{text}</div>
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button onClick={handleCopy} className="hover:bg-muted/80 shrink-0 self-center rounded-md p-1 transition-colors" aria-label="Copy to clipboard">
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="text-muted-foreground size-3.5" />}
        </button>
    )
}

function joinSummary(...parts: Array<string | null | undefined>): string | undefined {
    const kept = parts.filter((part): part is string => !!part)
    return kept.length > 0 ? kept.join(" · ") : undefined
}

function describeList(items: string[], noun: string): string | undefined {
    if (items.length === 0) return undefined
    if (items.length <= 2) return items.join(", ")
    return `${items.length} ${noun}s`
}

function formatFrequency(frequency: { number: number; unit: FrequencyUnit }): string {
    const amount = Math.max(1, frequency.number)
    return amount === 1 ? `Every ${frequency.unit}` : `Every ${amount} ${frequency.unit}s`
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
    if (type === "pull_request.comment.created") return "PR comment added"
    if (type === "pull_request.comment.edited") return "PR comment edited"
    if (type === "issues.opened") return "Issue created"
    if (type === "issue_comment.created") return "Issue comment"
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

function formatAttioEvent(eventType: string): string {
    const words = eventType.replace(/[-.]/g, " ").split(" ").filter(Boolean)
    if (words.length === 0) return eventType
    const [first, ...rest] = words
    return [first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(), ...rest.map(w => w.toLowerCase())].join(" ")
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
