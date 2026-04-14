// CI test fixture -- mimics `terse generate` output to verify SDK API contract.
// If this file stops compiling, the SDK has a breaking change.

import {
    GitHubConfig,
    SlackConfig,
    SlackOutputConfig,
    GmailConfig,
    GmailOutputConfig,
    GmailDraftOutputConfig,
    NotionConfig,
    LinearInputConfig,
    LinearOutputConfig,
    PosthogConfig,
    DatadogConfig,
    TimeTriggerConfig,
    LaunchDarklyConfig,
    TerseConfig,
    WorkOSInputConfig,
    WorkOSOutputConfig,
    AttioOutputConfig,
    SnowflakeOutputConfig,
    WebhookInputConfig,
    SlackEventType,
    GitHubEventType,
    LinearEventType,
    GmailEventType,
    WorkOSEventType,
    type TypedTrigger,
    type TypedSkill,
    type GithubPushTrigger,
    type GithubPROpenedTrigger,
    type GithubPRMergedTrigger,
    type GithubPRClosedTrigger,
    type GithubPRSynchronizedTrigger,
    type GithubPRTrigger,
    type GithubTrigger,
    type SlackMessageTrigger,
    type SlackAppMentionTrigger,
    type SlackReactionAddedTrigger,
    type SlackTrigger,
    type GmailTrigger,
    type LinearIssueCreatedTrigger,
    type LinearIssueUpdatedTrigger,
    type LinearCommentCreatedTrigger,
    type LinearTrigger,
    type CronTrigger,
    type WebhookTrigger,
    type WorkOSUserCreatedTrigger,
    type WorkOSUserUpdatedTrigger,
    type WorkOSUserDeletedTrigger,
    type WorkOSOrganizationMembershipCreatedTrigger,
    type WorkOSOrganizationMembershipUpdatedTrigger,
    type WorkOSOrganizationMembershipDeletedTrigger,
    type WorkOSMembershipTrigger,
    type WorkOSInvitationCreatedTrigger,
    type WorkOSInvitationResentTrigger,
    type WorkOSInvitationAcceptedTrigger,
    type WorkOSInvitationRevokedTrigger,
    type WorkOSInvitationTrigger,
    type WorkOSOrganizationTrigger,
    type WorkOSTrigger,
    type WorkOSUserTrigger,
} from "terse-sdk"

// ─── GitHub ─────────────────────────────────────────────────────────────────

export class GithubOwner {
    constructor(public readonly name: string) {}

    static CIOrg = new GithubOwner("ci-test-org")
}

export class Repos {
    constructor(
        public readonly repositoryId: number,
        public readonly name: string,
        public readonly owner: GithubOwner,
        public readonly fullName: string
    ) {}

    static CIOrg = {
        SampleRepo: new Repos(1, "sample-repo", GithubOwner.CIOrg, "ci-test-org/sample-repo"),
        AnotherRepo: new Repos(2, "another-repo", GithubOwner.CIOrg, "ci-test-org/another-repo"),
    } as const
}

export const GitHub = {
    onPush(opts: { repo: Repos }): TypedTrigger<GithubPushTrigger> {
        return new GitHubConfig("ci-github", [opts.repo.repositoryId], [GitHubEventType.PUSH])
    },
    onPROpened(opts: { repo: Repos }): TypedTrigger<GithubPROpenedTrigger> {
        return new GitHubConfig("ci-github", [opts.repo.repositoryId], [GitHubEventType.PR_OPENED])
    },
    onPRMerged(opts: { repo: Repos }): TypedTrigger<GithubPRMergedTrigger> {
        return new GitHubConfig("ci-github", [opts.repo.repositoryId], [GitHubEventType.PR_MERGED])
    },
    onPRClosed(opts: { repo: Repos }): TypedTrigger<GithubPRClosedTrigger> {
        return new GitHubConfig("ci-github", [opts.repo.repositoryId], [GitHubEventType.PR_CLOSED])
    },
    onPRSynchronized(opts: { repo: Repos }): TypedTrigger<GithubPRSynchronizedTrigger> {
        return new GitHubConfig("ci-github", [opts.repo.repositoryId], [GitHubEventType.PR_SYNCHRONIZE])
    },
    onPR(opts: { repo: Repos }): TypedTrigger<GithubPRTrigger> {
        return new GitHubConfig("ci-github", [opts.repo.repositoryId], [GitHubEventType.PR_OPENED, GitHubEventType.PR_MERGED, GitHubEventType.PR_CLOSED, GitHubEventType.PR_SYNCHRONIZE])
    },
    trigger(opts: { repos: Repos[]; eventTypes?: GitHubEventType[] }): TypedTrigger<GithubTrigger> {
        return new GitHubConfig("ci-github", opts.repos.map(r => r.repositoryId), opts.eventTypes)
    },
    skill(opts: { repos: Repos[] }): TypedSkill<string> {
        return new GitHubConfig("ci-github", opts.repos.map(r => r.repositoryId)) as TypedSkill<string>
    },
}

// ─── Slack ───────────────────────────────────────────────────────────────────

export class SlackChannel {
    constructor(public readonly channelId: string, public readonly name: string) {}

    static General = new SlackChannel("C001", "general")
}

export const Slack = {
    onMessage(opts: { channel: SlackChannel; userIds?: string[] }): TypedTrigger<SlackMessageTrigger> {
        return new SlackConfig("ci-slack", opts.channel.channelId, opts.channel.name, false, opts.userIds ?? [], [SlackEventType.MESSAGE])
    },
    onDm(opts?: { userIds?: string[] }): TypedTrigger<SlackMessageTrigger> {
        return new SlackConfig("ci-slack", undefined, undefined, true, opts?.userIds ?? [], [SlackEventType.MESSAGE])
    },
    onAppMention(opts: { channel: SlackChannel; userIds?: string[] }): TypedTrigger<SlackAppMentionTrigger> {
        return new SlackConfig("ci-slack", opts.channel.channelId, opts.channel.name, false, opts.userIds ?? [], [SlackEventType.APP_MENTION])
    },
    onReactionAdded(opts: { channel: SlackChannel; userIds?: string[] }): TypedTrigger<SlackReactionAddedTrigger> {
        return new SlackConfig("ci-slack", opts.channel.channelId, opts.channel.name, false, opts.userIds ?? [], [SlackEventType.REACTION_ADDED])
    },
    trigger(opts?: { channel?: SlackChannel; listenToUserDms?: boolean; userIds?: string[]; eventTypes?: SlackEventType[] }): TypedTrigger<SlackTrigger> {
        return new SlackConfig("ci-slack", opts?.channel?.channelId, opts?.channel?.name, opts?.listenToUserDms, opts?.userIds ?? [], opts?.eventTypes)
    },
    skill(opts: { channel: SlackChannel; userIds?: string[]; userNames?: string[]; listenToUserDms?: boolean }): TypedSkill<string> {
        return new SlackOutputConfig("ci-slack", opts.channel.channelId ?? null, opts.channel.name ?? null, opts.userIds ?? [], opts.userNames ?? null, opts.listenToUserDms) as TypedSkill<string>
    },
}

// ─── Gmail ───────────────────────────────────────────────────────────────────

export const Gmail = {
    onEmail(): TypedTrigger<GmailTrigger> {
        return new GmailConfig("ci-gmail", [GmailEventType.EMAIL_RECEIVED])
    },
    trigger(opts?: { eventTypes?: GmailEventType[] }): TypedTrigger<GmailTrigger> {
        return new GmailConfig("ci-gmail", opts?.eventTypes)
    },
    skill(): TypedSkill<string> {
        return new GmailOutputConfig("ci-gmail") as TypedSkill<string>
    },
    draftSkill(): TypedSkill<string> {
        return new GmailDraftOutputConfig("ci-gmail") as TypedSkill<string>
    },
}

// ─── Linear ──────────────────────────────────────────────────────────────────

export class LinearTeam {
    constructor(public readonly teamId: string, public readonly name: string) {}

    static Engineering = new LinearTeam("team-001", "Engineering")
}

export class LinearProject {
    constructor(public readonly projectId: string, public readonly name: string) {}

    static CIProject = new LinearProject("proj-001", "CI Project")
}

export const Linear = {
    onIssueCreated(opts?: { team?: LinearTeam; project?: LinearProject }): TypedTrigger<LinearIssueCreatedTrigger> {
        return new LinearInputConfig("ci-linear", opts?.project?.projectId ?? null, [LinearEventType.ISSUE_CREATED], opts?.team?.teamId ?? null)
    },
    onIssueUpdated(opts?: { team?: LinearTeam; project?: LinearProject }): TypedTrigger<LinearIssueUpdatedTrigger> {
        return new LinearInputConfig("ci-linear", opts?.project?.projectId ?? null, [LinearEventType.ISSUE_UPDATED], opts?.team?.teamId ?? null)
    },
    onComment(opts?: { team?: LinearTeam; project?: LinearProject }): TypedTrigger<LinearCommentCreatedTrigger> {
        return new LinearInputConfig("ci-linear", opts?.project?.projectId ?? null, [LinearEventType.COMMENT_CREATED], opts?.team?.teamId ?? null)
    },
    trigger(opts?: { team?: LinearTeam; project?: LinearProject; eventTypes?: LinearEventType[] }): TypedTrigger<LinearTrigger> {
        return new LinearInputConfig("ci-linear", opts?.project?.projectId ?? null, opts?.eventTypes, opts?.team?.teamId ?? null)
    },
    skill(opts?: { team?: LinearTeam; project?: LinearProject }): TypedSkill<string> {
        return new LinearOutputConfig(
            "ci-linear",
            opts?.team?.teamId ?? null,
            opts?.team?.name ?? null,
            opts?.project?.projectId ?? null
        ) as TypedSkill<string>
    },
}

// ─── Notion ──────────────────────────────────────────────────────────────────

export class NotionDatabase {
    constructor(public readonly databaseId: string, public readonly title: string) {}

    static Tasks = new NotionDatabase("db-001", "Tasks")
}

export class NotionPage {
    constructor(public readonly pageId: string, public readonly title: string) {}

    static Welcome = new NotionPage("page-001", "Welcome")
}

export const Notion = {
    skill(opts?: { databases?: NotionDatabase[]; pages?: NotionPage[] }): TypedSkill<string> {
        return new NotionConfig("ci-notion",
            opts?.databases?.map(d => d.databaseId), opts?.databases?.map(d => d.title),
            opts?.pages?.map(p => p.pageId), opts?.pages?.map(p => p.title)) as TypedSkill<string>
    },
}

// ─── PostHog ─────────────────────────────────────────────────────────────────

export class PosthogProject {
    constructor(public readonly projectId: string, public readonly name: string) {}

    static Main = new PosthogProject("ph-001", "Main")
}

export const Posthog = {
    skill(opts: { project: PosthogProject }): TypedSkill<string> {
        return new PosthogConfig("ci-posthog", opts.project.projectId, opts.project.name) as TypedSkill<string>
    },
}

// ─── Datadog ─────────────────────────────────────────────────────────────────

export class DatadogIndex {
    constructor(public readonly name: string) {}

    static Main = new DatadogIndex("main")
}

export const Datadog = {
    skill(opts?: { indexes?: DatadogIndex[] }): TypedSkill<string> {
        return new DatadogConfig("ci-datadog", opts?.indexes?.map(i => i.name)) as TypedSkill<string>
    },
}

// ─── LaunchDarkly ────────────────────────────────────────────────────────────

export class LaunchDarklyProject {
    constructor(public readonly projectKey: string, public readonly name: string) {}

    static Main = new LaunchDarklyProject("main", "Main")
}

export const LaunchDarkly = {
    skill(opts: { project: LaunchDarklyProject; environmentKeys: string[] }): TypedSkill<string> {
        return new LaunchDarklyConfig("ci-launchdarkly", opts.project.projectKey, opts.environmentKeys) as TypedSkill<string>
    },
}

// ─── WorkOS ──────────────────────────────────────────────────────────────────

export const WorkOS = {
    onUserCreated(): TypedTrigger<WorkOSUserCreatedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.USER_CREATED])
    },
    onUserUpdated(): TypedTrigger<WorkOSUserUpdatedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.USER_UPDATED])
    },
    onUserDeleted(): TypedTrigger<WorkOSUserDeletedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.USER_DELETED])
    },
    onMembershipCreated(): TypedTrigger<WorkOSOrganizationMembershipCreatedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED])
    },
    onMembershipUpdated(): TypedTrigger<WorkOSOrganizationMembershipUpdatedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED])
    },
    onMembershipDeleted(): TypedTrigger<WorkOSOrganizationMembershipDeletedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED])
    },
    onMembershipChanged(): TypedTrigger<WorkOSMembershipTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED, WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED, WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED])
    },
    onInvitationSent(): TypedTrigger<WorkOSInvitationTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.INVITATION_CREATED, WorkOSEventType.INVITATION_RESENT])
    },
    onInvitationCreated(): TypedTrigger<WorkOSInvitationCreatedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.INVITATION_CREATED])
    },
    onInvitationResent(): TypedTrigger<WorkOSInvitationResentTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.INVITATION_RESENT])
    },
    onInvitationAccepted(): TypedTrigger<WorkOSInvitationAcceptedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.INVITATION_ACCEPTED])
    },
    onInvitationRevoked(): TypedTrigger<WorkOSInvitationRevokedTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.INVITATION_REVOKED])
    },
    onOrganizationCreated(): TypedTrigger<WorkOSOrganizationTrigger> {
        return new WorkOSInputConfig("ci-workos", [WorkOSEventType.ORGANIZATION_CREATED])
    },
    trigger(opts?: { eventTypes?: WorkOSEventType[] }): TypedTrigger<WorkOSTrigger | WorkOSUserTrigger | WorkOSMembershipTrigger | WorkOSInvitationTrigger | WorkOSOrganizationTrigger> {
        return new WorkOSInputConfig("ci-workos", opts?.eventTypes)
    },
    skill(): TypedSkill<string> {
        return new WorkOSOutputConfig("ci-workos") as TypedSkill<string>
    },
}

// ─── Attio ───────────────────────────────────────────────────────────────────

export type AttioAttributeDefinition<TSlug extends string = string, TType extends string = string> = {
    apiSlug: TSlug
    title?: string
    type?: TType
    isRequired?: boolean
    isUnique?: boolean
}

export class AttioObject<
    TSlug extends string = string,
    TRecordValues extends Record<string, unknown> = Record<string, unknown>,
    TInputValues extends Record<string, unknown> = TRecordValues
> {
    constructor(
        public readonly apiSlug: TSlug,
        public readonly name: string,
        public readonly attributes: readonly AttioAttributeDefinition[] = []
    ) {}

    declare readonly __recordValues: TRecordValues
    declare readonly __inputValues: TInputValues

    static Companies = new AttioObject("companies", "Company", [
        { apiSlug: "name", title: "Name", type: "text", isRequired: true },
    ])
}

export const Attio = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    skill(opts: { object: AttioObject<any> }): TypedSkill<string> {
        return new AttioOutputConfig("ci-attio", opts.object.apiSlug) as TypedSkill<string>
    },
}

// ─── Snowflake ───────────────────────────────────────────────────────────────

export const Snowflake = {
    skill(): TypedSkill<string> {
        return new SnowflakeOutputConfig("ci-snowflake") as TypedSkill<string>
    },
}

// ─── Schedule ────────────────────────────────────────────────────────────────

export const Schedule = {
    cron(opts: { expression: string }): TypedTrigger<CronTrigger> {
        return new TimeTriggerConfig(opts.expression)
    },
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export const Webhook = {
    onRequest(): TypedTrigger<WebhookTrigger> {
        return new WebhookInputConfig()
    },
}

// ─── Terse ───────────────────────────────────────────────────────────────────

export const Terse = {
    skill(): TypedSkill<string> {
        return new TerseConfig() as TypedSkill<string>
    },
}
