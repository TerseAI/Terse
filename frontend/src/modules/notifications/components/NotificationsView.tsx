import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useSearchParams } from "react-router-dom"

import { zodResolver } from "@hookform/resolvers/zod"
import { AxiosError } from "axios"
import { ExternalLink, Loader2, Mail, Send, XCircle } from "lucide-react"
import { toast } from "sonner"
import { ApprovalRequestFilter, parseDeepLink } from "terse-types/ApprovalTypes"
import { NotificationDestination, type NotificationSettings as NotificationSettingsData } from "terse-types/Notifications"
import { RUN_HISTORY_ACTION_TYPES, type RunHistoryActionType, RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { type SentNotification, SentNotificationEventType, SentNotificationStatus } from "terse-types/SentNotifications"
import z from "zod"

import { MultiSelect } from "@/components/MultiSelect"
import { PageFrame } from "@/components/PageFrame"
import StatusBadge from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BackendProvider } from "@/lib/http"
import { sendToolApprovalResponse } from "@/lib/socket"
import { SlackIcon } from "@/modules/integrations/components/IntegrationIcons"
import { useNotificationDestinations } from "@/modules/notifications/api/useNotificationDestinations"
import { useNotificationSettings } from "@/modules/notifications/api/useNotificationSettings"
import { usePendingApprovals } from "@/modules/notifications/api/usePendingApprovals"
import { useSentNotifications } from "@/modules/notifications/api/useSentNotifications"
import { AddNotificationDestination } from "@/modules/notifications/components/AddNotificationDestination"
import ApprovalRequestItem from "@/modules/notifications/components/ApprovalRequestItem"
import { NotificationDestinationItem } from "@/modules/notifications/components/NotificationDestination"
import { NOTIFICATION_ACTION_OPTIONS } from "@/modules/notifications/constants/notificationActions"
import RunHistoryPagination from "@/modules/runHistory/components/RunHistoryPagination"
import { useRunHistoryChatDrawer } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"
import { formatRelativeTime } from "@/utils/time"

const NOTIFICATIONS_PAGE_SIZE = 12
const ALL_RUN_STATUSES = Object.values(RunHistoryStatus) as RunHistoryStatus[]
const APPROVAL_FILTER_OPTIONS: Array<{ value: ApprovalRequestFilter; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" }
]
const ADD_DESTINATION_QUERY_PARAM = "addDestination"
const INBOX_VIEW_PARAM = "view"
const INBOX_TABS = ["approvals", "sent", "defaults"] as const
type InboxTab = (typeof INBOX_TABS)[number]

function isInboxTab(value: string | null): value is InboxTab {
    return INBOX_TABS.includes(value as InboxTab)
}

function NotificationsPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { notificationDestinations, isError: isDestinationsError, isValidating: isDestinationsValidating, mutate: mutateDestinations } = useNotificationDestinations()
    const viewParam = searchParams.get(INBOX_VIEW_PARAM)
    const activeTab: InboxTab = isInboxTab(viewParam) ? viewParam : "approvals"

    const selectTab = (next: string) => {
        const params = new URLSearchParams(searchParams)
        if (next === "approvals") {
            params.delete(INBOX_VIEW_PARAM)
        } else if (isInboxTab(next)) {
            params.set(INBOX_VIEW_PARAM, next)
        }
        setSearchParams(params, { replace: true })
    }

    const [approvalFilter, setApprovalFilter] = useState<ApprovalRequestFilter>("pending")
    const { approvals, isLoading: isApprovalsLoading, isError: isApprovalsError, mutate: mutateApprovals } = usePendingApprovals({ status: approvalFilter })
    const { approvals: pendingApprovals } = usePendingApprovals({ status: "pending" })
    const pendingCount = pendingApprovals.length
    const [notificationsPage, setNotificationsPage] = useState(1)
    const [isAddDestinationDialogOpen, setIsAddDestinationDialogOpen] = useState(false)
    const {
        notifications,
        total,
        isLoading: isNotificationsLoading,
        isError: isNotificationsError
    } = useSentNotifications({
        page: notificationsPage,
        pageSize: NOTIFICATIONS_PAGE_SIZE
    })
    const { openDrawer } = useRunHistoryChatDrawer()

    const totalNotificationPages = Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE))
    const hasDestinationData = notificationDestinations !== undefined && notificationDestinations.length > 0
    const shouldShowDestinationsLoading = isDestinationsValidating && notificationDestinations === undefined

    useEffect(() => {
        if (notificationsPage > totalNotificationPages) {
            setNotificationsPage(totalNotificationPages)
        }
    }, [notificationsPage, totalNotificationPages])

    useEffect(() => {
        if (searchParams.get(ADD_DESTINATION_QUERY_PARAM) !== "true") {
            return
        }

        setIsAddDestinationDialogOpen(true)

        const nextSearchParams = new URLSearchParams(searchParams)
        nextSearchParams.delete(ADD_DESTINATION_QUERY_PARAM)
        nextSearchParams.set(INBOX_VIEW_PARAM, "defaults")
        setSearchParams(nextSearchParams, { replace: true })
    }, [searchParams, setSearchParams])

    const handleDeepLinkAction = async (deepLink: string) => {
        const { type, params } = parseDeepLink(deepLink)

        switch (type) {
            case "open_run_history": {
                const [agentId, runId] = params
                if (!agentId || !runId) {
                    return
                }

                try {
                    const response = await BackendProvider.getRunHistory(agentId, {
                        page: 1,
                        pageSize: 20,
                        q: runId,
                        status: ALL_RUN_STATUSES
                    })
                    const initialRunIndex = response.items.findIndex(run => run.id === runId)
                    if (initialRunIndex === -1) {
                        return
                    }

                    openDrawer({
                        runs: response.items,
                        initialRunIndex
                    })
                } catch {
                    // Run may have been deleted; silently ignore deep link failure
                }
                return
            }
            case "approve_action": {
                const [runId, stepId] = params
                if (!runId || !stepId) {
                    return
                }

                sendToolApprovalResponse(runId, stepId, true)
                void mutateApprovals()
                return
            }
            case "reject_action": {
                const [runId, stepId] = params
                if (!runId || !stepId) {
                    return
                }

                sendToolApprovalResponse(runId, stepId, false)
                void mutateApprovals()
                return
            }
            default:
                // Unsupported deep link action; silently ignore
                return
        }
    }

    return (
        <PageFrame>
            <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Inbox</h1>

            {hasDestinationData && (
                <AddNotificationDestination
                    trigger={<button type="button" className="hidden" aria-hidden="true" tabIndex={-1} />}
                    externalOpen={isAddDestinationDialogOpen}
                    onExternalOpenChange={setIsAddDestinationDialogOpen}
                />
            )}

            <Tabs value={activeTab} onValueChange={selectTab}>
                <TabsList variant="line" className="mb-6 justify-start gap-6">
                    <TabsTrigger variant="line" value="approvals" className="flex-none px-0 after:inset-x-0">
                        Approvals
                        {pendingCount > 0 ? <InboxTabBadge count={pendingCount} /> : null}
                    </TabsTrigger>
                    <TabsTrigger variant="line" value="sent" className="flex-none px-0 after:inset-x-0">
                        Sent
                    </TabsTrigger>
                    <TabsTrigger variant="line" value="defaults" className="flex-none px-0 after:inset-x-0">
                        Defaults
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="approvals" className="mt-0">
                    <div className="mb-3 flex justify-end">
                        <Select value={approvalFilter} onValueChange={value => setApprovalFilter(value as ApprovalRequestFilter)}>
                            <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Filter" />
                            </SelectTrigger>
                            <SelectContent>
                                {APPROVAL_FILTER_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isApprovalsLoading && <LoadingApprovalsList />}

                    {!isApprovalsLoading && isApprovalsError && <ErrorApprovalsList onRetry={() => mutateApprovals()} />}

                    {!isApprovalsLoading && !isApprovalsError && approvals.length === 0 && <EmptyApprovalsList />}

                    {!isApprovalsLoading && !isApprovalsError && approvals.length > 0 && (
                        <div className="space-y-3">
                            {approvals.map(approval => (
                                <ApprovalRequestItem key={approval.id} approval={approval} onAction={deepLink => void handleDeepLinkAction(deepLink)} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="sent" className="mt-0">
                    <div className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60 bg-card">
                        {isNotificationsLoading && <LoadingSentNotifications />}
                        {!isNotificationsLoading && isNotificationsError && <SentNotificationsError />}
                        {!isNotificationsLoading && !isNotificationsError && notifications.length === 0 && <SentNotificationsEmpty />}
                        {!isNotificationsLoading && !isNotificationsError && notifications.map(notification => <SentNotificationRow key={notification.id} notification={notification} />)}
                    </div>
                    {totalNotificationPages > 1 && (
                        <div className="mt-4 flex justify-end">
                            <RunHistoryPagination currentPage={notificationsPage} totalPages={totalNotificationPages} onPageChange={setNotificationsPage} />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="defaults" className="mt-0">
                    <Tabs defaultValue="destinations">
                        <TabsList variant="line" className="mb-4 justify-start gap-6">
                            <TabsTrigger variant="line" value="destinations" className="flex-none px-0 after:inset-x-0">
                                Destinations
                            </TabsTrigger>
                            <TabsTrigger variant="line" value="types" className="flex-none px-0 after:inset-x-0">
                                Event types
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="destinations" className="mt-0">
                            {shouldShowDestinationsLoading && <LoadingNotificationChannelList />}
                            {!shouldShowDestinationsLoading && (isDestinationsError || notificationDestinations === undefined) && <ErrorNotificationChannelList onRetry={() => mutateDestinations()} />}
                            {!shouldShowDestinationsLoading && !isDestinationsError && notificationDestinations !== undefined && (
                                <NotificationChannelList
                                    notificationDestinations={notificationDestinations}
                                    addDestinationDialogOpen={isAddDestinationDialogOpen}
                                    onAddDestinationDialogOpenChange={setIsAddDestinationDialogOpen}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="types" className="mt-0">
                            <NotificationSettings />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </PageFrame>
    )
}

function InboxTabBadge({ count }: { count: number }) {
    return (
        <span className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums">
            {count > 99 ? "99+" : count}
        </span>
    )
}

function NotificationChannelList({
    notificationDestinations,
    addDestinationDialogOpen,
    onAddDestinationDialogOpenChange
}: {
    notificationDestinations: NotificationDestination[]
    addDestinationDialogOpen: boolean
    onAddDestinationDialogOpenChange: (open: boolean) => void
}) {
    if (notificationDestinations.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-border/60 px-3 py-3">
                <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="whitespace-normal break-words">No destination added yet. Notifications go to email by default.</span>
                    </div>
                    <div>
                        <AddNotificationDestination externalOpen={addDestinationDialogOpen} onExternalOpenChange={onAddDestinationDialogOpenChange} />
                    </div>
                </div>
            </div>
        )
    }

    if (notificationDestinations.length > 2) {
        return (
            <ScrollArea className="max-h-[9rem] pr-2">
                <div className="flex flex-col gap-2">
                    {notificationDestinations.map(channel => (
                        <NotificationDestinationItem key={channel.id} destination={channel} />
                    ))}
                </div>
            </ScrollArea>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {notificationDestinations.map(channel => (
                <NotificationDestinationItem key={channel.id} destination={channel} />
            ))}
        </div>
    )
}

function LoadingNotificationChannelList() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
        </div>
    )
}

function ErrorNotificationChannelList({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm text-danger">Unable to load destinations right now.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                    Retry
                </Button>
            </div>
        </div>
    )
}

function LoadingApprovalsList() {
    return (
        <div className="space-y-3 py-2">
            <Skeleton className="h-[6.75rem] w-full rounded-lg" />
            <Skeleton className="h-[6.75rem] w-full rounded-lg" />
            <Skeleton className="h-[6.75rem] w-full rounded-lg" />
        </div>
    )
}

function ErrorApprovalsList({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm text-danger">Unable to load pending approvals.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                Retry
            </Button>
        </div>
    )
}

function EmptyApprovalsList() {
    return <div className="rounded-lg border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">No pending approvals.</div>
}

function formatEventType(eventType: SentNotificationEventType): string {
    switch (eventType) {
        case SentNotificationEventType.RUN_NOTIFICATION:
            return "Run notification"
        case SentNotificationEventType.APPROVAL_REQUEST:
            return "Approval request"
        case SentNotificationEventType.RUN_FAILURE:
            return "Run failure"
        case SentNotificationEventType.WEEKLY_REVIEW:
            return "Weekly job review"
        default:
            throw eventType satisfies never
    }
}

function NotificationStatusBadge({ status }: { status: SentNotificationStatus }) {
    switch (status) {
        case SentNotificationStatus.SENT:
            return <StatusBadge text="Sent" status="success" icon={Send} />
        case SentNotificationStatus.FAILED:
            return <StatusBadge text="Failed" status="error" icon={XCircle} />
    }
}

function SentNotificationDestinationIcon({ destinationType }: { destinationType: SentNotification["destinationType"] }) {
    if (destinationType === "email") {
        return <Mail className="h-3.5 w-3.5 text-muted-foreground" />
    }

    return (
        <div className="h-3.5 w-3.5">
            <SlackIcon />
        </div>
    )
}

function SentNotificationRow({ notification }: { notification: SentNotification }) {
    const normalizedAgentName = notification.agentName?.trim()
    const shouldShowAgent = Boolean(normalizedAgentName && normalizedAgentName.toLowerCase() !== "unknown")

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="max-w-full shrink-0 truncate text-sm font-medium text-foreground">{formatEventType(notification.eventType)}</span>
                    {shouldShowAgent && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground" title={normalizedAgentName}>
                            {normalizedAgentName}
                        </span>
                    )}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <SentNotificationDestinationIcon destinationType={notification.destinationType} />
                    <span className="truncate">{notification.destinationLabel}</span>
                    {notification.notificationUrl && (
                        <a
                            href={notification.notificationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View in Slack"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </div>
            <div className="shrink-0">
                <NotificationStatusBadge status={notification.status} />
            </div>
            <span className="w-20 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatRelativeTime(notification.sentAt)}</span>
        </div>
    )
}

function LoadingSentNotifications() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={`loading-${index}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                    <Skeleton className="h-3 w-20 shrink-0" />
                </div>
            ))}
        </>
    )
}

function SentNotificationsError() {
    return <p className="px-4 py-8 text-center text-sm text-danger">Unable to load sent notifications.</p>
}

function SentNotificationsEmpty() {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications sent yet.</p>
}

const notificationSettingsSchema = z.object({
    agentDefaultNotifications: z.array(z.enum(RUN_HISTORY_ACTION_TYPES)),
    weeklyAgentImprovements: z.boolean()
})

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>

function normalizeActionTypes(actionTypes: RunHistoryActionType[]): RunHistoryActionType[] {
    return Array.from(new Set(actionTypes)).sort()
}

function areActionTypeSetsEqual(left: RunHistoryActionType[], right: RunHistoryActionType[]): boolean {
    const normalizedLeft = normalizeActionTypes(left)
    const normalizedRight = normalizeActionTypes(right)
    if (normalizedLeft.length !== normalizedRight.length) {
        return false
    }

    return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

function NotificationSettings() {
    const { notificationSettings, isError, isValidating, mutate: mutateSettings } = useNotificationSettings()

    if (isValidating && notificationSettings === undefined) {
        return <LoadingNotificationSettings />
    }

    if (isError || notificationSettings === undefined) {
        return <ErrorNotificationSettings onRetry={() => void mutateSettings()} />
    }

    return <NotificationSettingsForm notificationSettings={notificationSettings} mutateSettings={() => mutateSettings()} />
}

type NotificationSettingsFormProps = {
    notificationSettings: NotificationSettingsData
    mutateSettings: () => Promise<unknown>
}

function NotificationSettingsForm({ notificationSettings, mutateSettings }: NotificationSettingsFormProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isApplyToAllDialogOpen, setIsApplyToAllDialogOpen] = useState(false)
    const [pendingSubmitValues, setPendingSubmitValues] = useState<NotificationSettingsFormValues | null>(null)

    const form = useForm<NotificationSettingsFormValues>({
        resolver: zodResolver(notificationSettingsSchema),
        defaultValues: {
            agentDefaultNotifications: notificationSettings.agentDefaultNotifications,
            weeklyAgentImprovements: notificationSettings.weeklyAgentImprovements
        }
    })

    useEffect(() => {
        form.reset({
            agentDefaultNotifications: notificationSettings.agentDefaultNotifications,
            weeklyAgentImprovements: notificationSettings.weeklyAgentImprovements
        })
    }, [notificationSettings, form])

    async function saveNotificationSettings(values: NotificationSettingsFormValues, applyToAllAgents: boolean) {
        setError(null)
        setIsLoading(true)
        try {
            await BackendProvider.updateNotificationSettings(values.agentDefaultNotifications, values.weeklyAgentImprovements, applyToAllAgents)
            void mutateSettings()
            toast.success(applyToAllAgents ? "Notification settings updated for all jobs" : "Notification settings updated")
        } catch (err) {
            const message = err instanceof AxiosError && typeof err.response?.data?.error === "string" ? err.response.data.error : "Something went wrong. Please try again."
            setError(message)
        } finally {
            setIsLoading(false)
            setIsApplyToAllDialogOpen(false)
            setPendingSubmitValues(null)
        }
    }

    async function onSubmit(values: NotificationSettingsFormValues) {
        const currentDefaultNotifications = notificationSettings.agentDefaultNotifications
        const shouldConfirmApplyToAll = !areActionTypeSetsEqual(values.agentDefaultNotifications, currentDefaultNotifications)

        if (shouldConfirmApplyToAll) {
            setError(null)
            setPendingSubmitValues(values)
            setIsApplyToAllDialogOpen(true)
            return
        }

        await saveNotificationSettings(values, false)
    }

    function handleDialogOpenChange(open: boolean) {
        if (isLoading) {
            return
        }

        setIsApplyToAllDialogOpen(open)
        if (!open) {
            setPendingSubmitValues(null)
        }
    }

    function handleApplyToAllAgents(): void {
        if (!pendingSubmitValues || isLoading) {
            return
        }
        void saveNotificationSettings(pendingSubmitValues, true)
    }

    function handleUpdateDefaultsOnly(): void {
        if (!pendingSubmitValues || isLoading) {
            return
        }
        void saveNotificationSettings(pendingSubmitValues, false)
    }

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="agentDefaultNotifications"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notify me about</FormLabel>
                                <FormControl>
                                    <MultiSelect
                                        options={NOTIFICATION_ACTION_OPTIONS.map(option => ({
                                            id: option.value,
                                            label: option.label
                                        }))}
                                        selectedIds={field.value}
                                        onSelect={ids => field.onChange(ids as RunHistoryActionType[])}
                                        placeholder="Select event types…"
                                        searchPlaceholder="Search types…"
                                        emptyMessage="No types found."
                                        displayText={count => (count > 0 ? `${count} selected` : "Select event types…")}
                                        renderItem={option => {
                                            const actionOption = NOTIFICATION_ACTION_OPTIONS.find(opt => opt.value === option.id)
                                            return (
                                                <span className="flex items-center gap-2">
                                                    {actionOption?.icon}
                                                    {option.label}
                                                </span>
                                            )
                                        }}
                                        renderBadge={option => {
                                            const actionOption = NOTIFICATION_ACTION_OPTIONS.find(opt => opt.value === option.id)
                                            return (
                                                <span className="flex items-center gap-1">
                                                    {actionOption?.icon}
                                                    {option.label}
                                                </span>
                                            )
                                        }}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="weeklyAgentImprovements"
                        render={({ field }) => (
                            <FormItem className="pt-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="weekly-improvements" className="text-sm font-normal">
                                        Receive weekly job improvement email
                                    </Label>
                                    <FormControl>
                                        <Switch id="weekly-improvements" checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                                    </FormControl>
                                </div>
                            </FormItem>
                        )}
                    />

                    {error && <p className="text-sm text-danger">{error}</p>}

                    <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    </div>
                </form>
            </Form>

            <Dialog open={isApplyToAllDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apply to all jobs?</DialogTitle>
                        <DialogDescription>Do you want to apply these default notification event changes to every job in your organization?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button variant="secondary" onClick={handleUpdateDefaultsOnly} disabled={isLoading}>
                            Only update my defaults
                        </Button>
                        <Button onClick={handleApplyToAllAgents} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Apply to all jobs"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function LoadingNotificationSettings() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-16 w-2/3 rounded-lg" />
            <Skeleton className="ml-auto h-9 w-20 rounded-lg" />
        </div>
    )
}

function ErrorNotificationSettings({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm text-danger">Unable to load notification types right now.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                Retry
            </Button>
        </div>
    )
}

export default NotificationsPage
