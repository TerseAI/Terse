import { useEffect, useState } from "react"

import { Mail } from "lucide-react"

import { AddNotificationDestination } from "@/components/Notifications/AddNotificationDestination"
import ApprovalRequestItem from "@/components/Notifications/ApprovalRequestItem"
import { NotificationDestinationItem } from "@/components/Notifications/NotificationDestination"
import { SlackIcon } from "@/components/icons/IntegrationIcons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNotificationDestinations } from "@/hooks/api/useNotificationDestinations"
import { usePendingApprovals } from "@/hooks/api/usePendingApprovals"
import { useSentNotifications } from "@/hooks/api/useSentNotifications"
import { useRunHistoryChatDrawer } from "@/services/RunHistoryChatDrawerContext"
import { BackendProvider } from "@/services/backend"
import { ApprovalRequestFilter, parseDeepLink } from "@/shared/ApprovalTypes"
import { NotificationDestination } from "@/shared/Notifications"
import { RunHistoryStatus } from "@/shared/RunHistoryTypes"
import { type SentNotification, SentNotificationEventType, SentNotificationStatus } from "@/shared/SentNotifications"
import { sendToolApprovalResponse } from "@/socket"
import { formatRelativeTime } from "@/utility/timeUtils"

const NOTIFICATIONS_PAGE_SIZE = 12
const ALL_RUN_STATUSES = Object.values(RunHistoryStatus) as RunHistoryStatus[]
const APPROVAL_FILTER_OPTIONS: Array<{ value: ApprovalRequestFilter; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" }
]

function NotificationsPage() {
    const { notificationDestinations, isError: isDestinationsError, isValidating: isDestinationsValidating, mutate: mutateDestinations } = useNotificationDestinations()
    const [approvalFilter, setApprovalFilter] = useState<ApprovalRequestFilter>("pending")
    const { approvals, isLoading: isApprovalsLoading, isError: isApprovalsError, mutate: mutateApprovals } = usePendingApprovals({ status: approvalFilter })
    const [notificationsPage, setNotificationsPage] = useState(1)
    const {
        notifications,
        total,
        isLoading: isNotificationsLoading,
        isError: isNotificationsError,
        isValidating: isNotificationsValidating
    } = useSentNotifications({
        page: notificationsPage,
        pageSize: NOTIFICATIONS_PAGE_SIZE
    })
    const { openDrawer } = useRunHistoryChatDrawer()

    const totalNotificationPages = Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE))

    useEffect(() => {
        if (notificationsPage > totalNotificationPages) {
            setNotificationsPage(totalNotificationPages)
        }
    }, [notificationsPage, totalNotificationPages])

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
                } catch (error) {
                    console.error("Failed to open run history from notification action", {
                        error,
                        agentId,
                        runId
                    })
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
                console.warn("Unsupported notifications deep link action", { deepLink })
        }
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 pb-4 pt-2 lg:px-6 lg:pb-6 lg:pt-3">
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                <div className="flex min-h-0 flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3 px-1">
                            <p className="text-base font-semibold text-foreground">Notification Destinations</p>
                            {!isDestinationsValidating && notificationDestinations !== undefined && notificationDestinations.length > 0 && <AddNotificationDestination />}
                        </div>
                        <Card className="gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                            <CardContent className="p-4">
                                {isDestinationsValidating && <LoadingNotificationChannelList />}
                                {!isDestinationsValidating && (isDestinationsError || notificationDestinations === undefined) && <ErrorNotificationChannelList onRetry={() => mutateDestinations()} />}
                                {!isDestinationsValidating && !isDestinationsError && notificationDestinations !== undefined && (
                                    <NotificationChannelList notificationDestinations={notificationDestinations} />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <div className="flex items-center justify-between gap-3 px-1">
                            <div className="flex items-center gap-2">
                                <p className="text-base font-semibold text-foreground">Approvals</p>
                                <Badge variant="outline">{approvals.length}</Badge>
                            </div>
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
                        <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                            <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                                {isApprovalsLoading && <LoadingApprovalsList />}

                                {!isApprovalsLoading && isApprovalsError && <ErrorApprovalsList onRetry={() => mutateApprovals()} />}

                                {!isApprovalsLoading && !isApprovalsError && approvals.length === 0 && <EmptyApprovalsList />}

                                {!isApprovalsLoading && !isApprovalsError && approvals.length > 0 && (
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="space-y-3 py-2">
                                            {approvals.map(approval => (
                                                <ApprovalRequestItem key={approval.id} approval={approval} onAction={deepLink => void handleDeepLinkAction(deepLink)} />
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex h-full min-h-0 flex-col gap-2">
                    <div className="flex items-center justify-end gap-2 px-1">
                        <span className="text-xs text-muted-foreground">
                            Page {notificationsPage} of {totalNotificationPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={notificationsPage === 1 || isNotificationsLoading || isNotificationsValidating}
                            onClick={() => setNotificationsPage(page => Math.max(1, page - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={notificationsPage >= totalNotificationPages || isNotificationsLoading || isNotificationsValidating}
                            onClick={() => setNotificationsPage(page => Math.min(totalNotificationPages, page + 1))}
                        >
                            Next
                        </Button>
                    </div>
                    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                            <div className="flex min-h-0 flex-1 flex-col">
                                <ScrollArea className="min-h-0 flex-1">
                                    <Table>
                                        <TableHeader className="bg-muted/35">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="px-4">Event</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="pr-4">Timestamp</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isNotificationsLoading && <LoadingSentNotificationsRows />}
                                            {!isNotificationsLoading && isNotificationsError && <ErrorSentNotificationsRow />}
                                            {!isNotificationsLoading && !isNotificationsError && notifications.length === 0 && <EmptySentNotificationsRow />}
                                            {!isNotificationsLoading &&
                                                !isNotificationsError &&
                                                notifications.map(notification => <SentNotificationRow key={notification.id} notification={notification} />)}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function NotificationChannelList({ notificationDestinations }: { notificationDestinations: NotificationDestination[] }) {
    if (notificationDestinations.length === 0) {
        return (
            <div className="flex flex-col">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Mail className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle>Notifications are sent to email by default</EmptyTitle>
                        <EmptyDescription>Send notifications to a Slack channel or direct message.</EmptyDescription>
                        <AddNotificationDestination />
                    </EmptyHeader>
                </Empty>
            </div>
        )
    }

    if (notificationDestinations.length > 2) {
        return (
            <ScrollArea className="max-h-[9rem] pr-2">
                <div className="flex flex-col gap-4">
                    {notificationDestinations.map(channel => (
                        <NotificationDestinationItem key={channel.id} destination={channel} />
                    ))}
                </div>
            </ScrollArea>
        )
    }

    return (
        <div className="flex flex-col gap-4">
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
                <p className="text-sm text-destructive">Unable to load destinations right now.</p>
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
            <Skeleton className="h-[96px] w-full rounded-lg" />
            <Skeleton className="h-[96px] w-full rounded-lg" />
            <Skeleton className="h-[96px] w-full rounded-lg" />
        </div>
    )
}

function ErrorApprovalsList({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">Unable to load pending approvals.</p>
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
            return "Weekly agent review"
        default:
            throw eventType satisfies never
    }
}

function NotificationStatusBadge({ status }: { status: SentNotificationStatus }) {
    const labelMap: Record<SentNotificationStatus, string> = {
        [SentNotificationStatus.SENT]: "Sent",
        [SentNotificationStatus.FAILED]: "Failed"
    }

    const classNameMap: Record<SentNotificationStatus, string> = {
        [SentNotificationStatus.SENT]: "border-green-600/40 text-green-600 dark:text-green-400",
        [SentNotificationStatus.FAILED]: "border-destructive/40 text-destructive"
    }

    return (
        <Badge variant="outline" className={classNameMap[status]}>
            {labelMap[status]}
        </Badge>
    )
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
    const agentLabel = notification.agentName ? `Agent: ${notification.agentName}` : "Agent: Unknown"

    return (
        <TableRow key={notification.id}>
            <TableCell className="px-4">
                <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{formatEventType(notification.eventType)}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <SentNotificationDestinationIcon destinationType={notification.destinationType} />
                        {notification.destinationLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">{agentLabel}</span>
                </div>
            </TableCell>
            <TableCell>
                <NotificationStatusBadge status={notification.status} />
            </TableCell>
            <TableCell className="pr-4 text-muted-foreground">{formatRelativeTime(notification.sentAt)}</TableCell>
        </TableRow>
    )
}

function LoadingSentNotificationsRows() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`loading-${index}`}>
                    <TableCell className="px-4">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                    </TableCell>
                    <TableCell>
                        <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="pr-4">
                        <Skeleton className="h-4 w-20" />
                    </TableCell>
                </TableRow>
            ))}
        </>
    )
}

function ErrorSentNotificationsRow() {
    return (
        <TableRow>
            <TableCell className="px-4 py-6 text-sm text-destructive" colSpan={3}>
                Unable to load sent notifications.
            </TableCell>
        </TableRow>
    )
}

function EmptySentNotificationsRow() {
    return (
        <TableRow>
            <TableCell className="px-4 py-6 text-sm text-muted-foreground" colSpan={3}>
                No notifications sent yet.
            </TableCell>
        </TableRow>
    )
}

export default NotificationsPage
