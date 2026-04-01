import { IntegrationType } from "./shared/Integrations.js"
import type { ConfigInstance } from "./shared/Configs.js"
import type { SerializedEvent } from "./shared/types.js"
import type { WorkOSEventType } from "./shared/Configs.js"
import type { KnownBlock } from "@slack/types"

/**
 * Lightweight interface for input events.
 * The backend's concrete InputEvent abstract class structurally satisfies this interface.
 */
export interface InputEvent {
    readonly integrationType: IntegrationType
    readonly eventType: string
    formatForAgentRunner(): string
    debugLog(): string
}

/**
 * Lightweight interface for toolbox entries.
 * The backend's concrete ToolboxEntry (which depends on @openai/agents Tool) structurally satisfies this interface.
 */
export interface ToolboxEntry {
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
}

// ---------------------------------------------------------------------------
// TypedTrigger – phantom-typed ConfigInstance for generic event inference
// ---------------------------------------------------------------------------

export interface TypedTrigger<TEvent extends InputEvent = InputEvent> extends ConfigInstance {
    readonly __eventType?: TEvent
}

export type InferEvent<T> = T extends TypedTrigger<infer E> ? E : InputEvent
export type InferEvents<T extends readonly unknown[]> = InferEvent<T[number]>

// ---------------------------------------------------------------------------
// TypedSkill – phantom-typed ConfigInstance for skill tool inference
// ---------------------------------------------------------------------------

export interface TypedSkill<TToolName extends string = never> extends ConfigInstance {
    readonly __toolApprovalNames?: TToolName
}

export type InferToolApproval<T> = T extends TypedSkill<infer TToolName> ? TToolName : never
export type InferToolApprovals<T extends readonly unknown[]> = InferToolApproval<T[number]>

// ---------------------------------------------------------------------------
// GitHub event data interfaces
// ---------------------------------------------------------------------------

export interface GithubRepository {
    id: number
    name: string
    owner: string
    defaultBranch: string
}

export interface GithubUser {
    login: string
    email?: string
}

export interface GithubFileDiff {
    filename: string
    diff: string
}

export interface GithubCommit {
    sha: string
    message: string
    fileDiffs: GithubFileDiff[]
}

export interface GithubPRData {
    number: number
    title: string
    body?: string
    state: "open" | "closed"
    merged: boolean
    head: { ref: string; sha: string }
    base: { ref: string; sha: string }
    author: GithubUser
    url: string
}

// ---------------------------------------------------------------------------
// GitHub event classes
// ---------------------------------------------------------------------------

export class GithubInputEvent implements InputEvent {
    readonly integrationType = IntegrationType.GITHUB
    readonly eventType: string
    readonly repository: GithubRepository
    readonly sender: GithubUser
    readonly commits: GithubCommit[]
    private readonly _formattedContent: string
    private readonly _debugLog: string

    constructor(opts: {
        eventType: string
        repository: GithubRepository
        sender: GithubUser
        commits: GithubCommit[]
        formattedContent: string
        debugLog: string
    }) {
        this.eventType = opts.eventType
        this.repository = opts.repository
        this.sender = opts.sender
        this.commits = opts.commits
        this._formattedContent = opts.formattedContent
        this._debugLog = opts.debugLog
    }

    formatForAgentRunner(): string {
        return this._formattedContent
    }

    debugLog(): string {
        return this._debugLog
    }
}

export class GithubPRInputEvent extends GithubInputEvent {
    readonly pullRequest: GithubPRData

    constructor(opts: {
        eventType: string
        repository: GithubRepository
        sender: GithubUser
        commits: GithubCommit[]
        pullRequest: GithubPRData
        formattedContent: string
        debugLog: string
    }) {
        super(opts)
        this.pullRequest = opts.pullRequest
    }
}

export class GithubPushInputEvent extends GithubInputEvent {
    readonly branch: string

    constructor(opts: {
        eventType: string
        repository: GithubRepository
        sender: GithubUser
        commits: GithubCommit[]
        branch: string
        formattedContent: string
        debugLog: string
    }) {
        super(opts)
        this.branch = opts.branch
    }
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isGithubEvent(event: InputEvent): event is GithubInputEvent {
    return event instanceof GithubInputEvent
}

export function isGithubPREvent(event: InputEvent): event is GithubPRInputEvent {
    return event instanceof GithubPRInputEvent
}

export function isGithubPushEvent(event: InputEvent): event is GithubPushInputEvent {
    return event instanceof GithubPushInputEvent
}

// ---------------------------------------------------------------------------
// WorkOS event data interfaces
// ---------------------------------------------------------------------------

export interface WorkOSEventUser {
    id: string
    email: string
    firstName?: string
    lastName?: string
    emailVerified: boolean
    profilePictureUrl?: string
}

export interface WorkOSEventMembership {
    id: string
    userId: string
    organizationId: string
    role: { slug: string }
    status: string
}

export interface WorkOSEventInvitation {
    id: string
    email: string
    organizationId: string
    inviterEmail?: string
    state: string
    acceptedAt?: string
}

export interface WorkOSEventOrganization {
    id: string
    name: string
}

// ---------------------------------------------------------------------------
// WorkOS event classes
// ---------------------------------------------------------------------------

export class WorkOSInputEvent implements InputEvent {
    readonly integrationType = IntegrationType.WORKOS
    readonly eventType: WorkOSEventType | string
    readonly eventId: string
    readonly createdAt: string
    private readonly _formattedContent: string
    private readonly _debugLog: string

    constructor(opts: {
        eventType: WorkOSEventType | string
        eventId: string
        createdAt: string
        formattedContent: string
        debugLog: string
    }) {
        this.eventType = opts.eventType
        this.eventId = opts.eventId
        this.createdAt = opts.createdAt
        this._formattedContent = opts.formattedContent
        this._debugLog = opts.debugLog
    }

    formatForAgentRunner(): string {
        return this._formattedContent
    }

    debugLog(): string {
        return this._debugLog
    }
}

export class WorkOSUserInputEvent extends WorkOSInputEvent {
    readonly user: WorkOSEventUser

    constructor(opts: {
        eventType: WorkOSEventType | string
        eventId: string
        createdAt: string
        user: WorkOSEventUser
        formattedContent: string
        debugLog: string
    }) {
        super(opts)
        this.user = opts.user
    }
}

export class WorkOSMembershipInputEvent extends WorkOSInputEvent {
    readonly membership: WorkOSEventMembership

    constructor(opts: {
        eventType: WorkOSEventType | string
        eventId: string
        createdAt: string
        membership: WorkOSEventMembership
        formattedContent: string
        debugLog: string
    }) {
        super(opts)
        this.membership = opts.membership
    }
}

export class WorkOSInvitationInputEvent extends WorkOSInputEvent {
    readonly invitation: WorkOSEventInvitation
    readonly user?: WorkOSEventUser

    constructor(opts: {
        eventType: WorkOSEventType | string
        eventId: string
        createdAt: string
        invitation: WorkOSEventInvitation
        user?: WorkOSEventUser
        formattedContent: string
        debugLog: string
    }) {
        super(opts)
        this.invitation = opts.invitation
        this.user = opts.user
    }
}

export class WorkOSOrganizationInputEvent extends WorkOSInputEvent {
    readonly organization: WorkOSEventOrganization

    constructor(opts: {
        eventType: WorkOSEventType | string
        eventId: string
        createdAt: string
        organization: WorkOSEventOrganization
        formattedContent: string
        debugLog: string
    }) {
        super(opts)
        this.organization = opts.organization
    }
}

// ---------------------------------------------------------------------------
// WorkOS type guards
// ---------------------------------------------------------------------------

export function isWorkOSEvent(event: InputEvent): event is WorkOSInputEvent {
    return event instanceof WorkOSInputEvent
}

export function isWorkOSUserEvent(event: InputEvent): event is WorkOSUserInputEvent {
    return event instanceof WorkOSUserInputEvent
}

export function isWorkOSMembershipEvent(event: InputEvent): event is WorkOSMembershipInputEvent {
    return event instanceof WorkOSMembershipInputEvent
}

export function isWorkOSInvitationEvent(event: InputEvent): event is WorkOSInvitationInputEvent {
    return event instanceof WorkOSInvitationInputEvent
}

export function isWorkOSOrganizationEvent(event: InputEvent): event is WorkOSOrganizationInputEvent {
    return event instanceof WorkOSOrganizationInputEvent
}


// ---------------------------------------------------------------------------
// Slack event data interfaces
// ---------------------------------------------------------------------------


export enum SlackChannelType {
    CHANNEL = "channel",
    GROUP = "group",
    MPIM = "mpim",
    IM = "im"
}

export interface SlackAttachment {
    fallback?: string
    color?: string
    pretext?: string
    author_name?: string
    author_link?: string
    author_icon?: string
    title?: string
    title_link?: string
    text?: string
    fields?: Array<{
        title: string
        value: string
        short: boolean
    }>
    image_url?: string
    thumb_url?: string
    footer?: string
    footer_icon?: string
    ts?: number
}

export interface SlackFile {
    id: string
    name?: string
    title?: string
    mimetype?: string
    filetype?: string
    // Various URL formats for accessing the file
    url_private?: string
    url_private_download?: string
    thumb_64?: string
    thumb_80?: string
    thumb_160?: string
    thumb_360?: string
    thumb_480?: string
    thumb_720?: string
    thumb_800?: string
    thumb_960?: string
    thumb_1024?: string
    // For images
    original_w?: number
    original_h?: number
}



export class SlackMessageEvent implements InputEvent {
    readonly eventType: string
    readonly integrationType = IntegrationType.SLACK
    readonly channelId: string
    readonly channelName?: string
    readonly userId: string
    readonly userName?: string
    readonly text: string
    readonly timestamp: string
    readonly threadTs?: string
    readonly teamId: string
    readonly permalink?: string
    readonly channelType?: SlackChannelType
    readonly blocks?: KnownBlock[]
    readonly attachments?: SlackAttachment[]
    readonly files?: SlackFile[]
    private readonly _formattedContent: string
    private readonly _debugLog: string

    constructor(opts: {
    eventType: string
    channelId: string
    channelName?: string
    userId: string
    userName?: string
    text: string
    timestamp: string
    threadTs?: string
    teamId: string
    permalink?: string
    channelType?: SlackChannelType
    blocks?: KnownBlock[]
    attachments?: SlackAttachment[]
    files?: SlackFile[]
     formattedContent: string
        debugLog: string
    }) {
        this.eventType = opts.eventType
        this.channelId = opts.channelId
        this.channelName = opts.channelName
        this.userId = opts.userId
        this.userName = opts.userName
        this.text = opts.text
        this.timestamp = opts.timestamp
        this.threadTs = opts.threadTs
        this.teamId = opts.teamId
        this.permalink = opts.permalink
        this.channelType = opts.channelType
        this.attachments = opts.attachments
        this.files = opts.files
        this._formattedContent = opts.formattedContent
        this._debugLog = opts.debugLog
    }

    formatForAgentRunner(): string {
        return this._formattedContent
    }

    debugLog(): string {
        return this._debugLog
    }

    get threadTimestamp(): string | undefined {
        return this.threadTs
    }
}


// ---------------------------------------------------------------------------
// Generic fallback for non-typed serialized events
// ---------------------------------------------------------------------------

export class SerializedEventInputEvent implements InputEvent {
    readonly integrationType: IntegrationType
    readonly eventType: string
    private readonly formattedContent: string
    private readonly debugLogResult: string

    constructor(serializedEvent: SerializedEvent) {
        this.integrationType = serializedEvent.integrationType
        this.eventType = serializedEvent.eventType ?? "unknown"
        this.formattedContent = serializedEvent.formattedContent
        this.debugLogResult = serializedEvent.debugLog
    }

    formatForAgentRunner(): string {
        return this.formattedContent
    }

    debugLog(): string {
        return this.debugLogResult
    }
}

// ---------------------------------------------------------------------------
// Deserialization – constructs typed event subclasses from SerializedEvent
// ---------------------------------------------------------------------------

export function deserializeInputEvent(se: SerializedEvent): InputEvent {
    if (se.integrationType === IntegrationType.GITHUB && se.metadata) {
        const meta = se.metadata as {
            repository?: GithubRepository
            sender?: GithubUser
            commits?: GithubCommit[]
            pullRequest?: GithubPRData
            branch?: string
        }

        const base = {
            eventType: se.eventType ?? "unknown",
            repository: meta.repository ?? { id: 0, name: "", owner: "", defaultBranch: "main" },
            sender: meta.sender ?? { login: "" },
            commits: meta.commits ?? [],
            formattedContent: se.formattedContent,
            debugLog: se.debugLog
        }

        if (meta.pullRequest) {
            return new GithubPRInputEvent({ ...base, pullRequest: meta.pullRequest })
        }
        if (meta.branch) {
            return new GithubPushInputEvent({ ...base, branch: meta.branch })
        }
        return new GithubInputEvent(base)
    }

    if (se.integrationType === IntegrationType.WORKOS && se.metadata) {
        const meta = se.metadata as {
            eventId?: string
            createdAt?: string
            user?: WorkOSEventUser
            membership?: WorkOSEventMembership
            invitation?: WorkOSEventInvitation
            organization?: WorkOSEventOrganization
        }

        const base = {
            eventType: se.eventType ?? "unknown",
            eventId: meta.eventId ?? "",
            createdAt: meta.createdAt ?? "",
            formattedContent: se.formattedContent,
            debugLog: se.debugLog
        }

        if (meta.invitation) {
            return new WorkOSInvitationInputEvent({ ...base, invitation: meta.invitation, user: meta.user })
        }
        if (meta.user) {
            return new WorkOSUserInputEvent({ ...base, user: meta.user })
        }
        if (meta.membership) {
            return new WorkOSMembershipInputEvent({ ...base, membership: meta.membership })
        }
        if (meta.organization) {
            return new WorkOSOrganizationInputEvent({ ...base, organization: meta.organization })
        }
        return new WorkOSInputEvent(base)
    }

    if (se.integrationType === IntegrationType.SLACK && se.metadata) {
        const meta = se.metadata as {
            channelId?: string
            channelName?: string
            userId?: string
            userName?: string
            text?: string
            timestamp?: string
            threadTs?: string
            teamId?: string
            permalink?: string
            channelType?: SlackChannelType
            blocks?: KnownBlock[]
            attachments?: SlackAttachment[]
            files?: SlackFile[]
        }

        return new SlackMessageEvent({
            eventType: se.eventType ?? "unknown",
            channelId: meta.channelId ?? "",
            channelName: meta.channelName,
            userId: meta.userId ?? "",
            userName: meta.userName,
            text: meta.text ?? "",
            timestamp: meta.timestamp ?? "",
            threadTs: meta.threadTs,
            teamId: meta.teamId ?? "",
            permalink: meta.permalink,
            channelType: meta.channelType,
            blocks: meta.blocks,
            attachments: meta.attachments,
            files: meta.files,
            formattedContent: se.formattedContent,
            debugLog: se.debugLog
        })
    }

    return new SerializedEventInputEvent(se)
}
