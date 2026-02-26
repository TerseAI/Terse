import { useMemo, useState } from "react"

import { Mail } from "lucide-react"

import { AddNotificationDestination } from "../components/Notifications/AddNotificationDestination"
import { NotificationDestinationItem } from "../components/Notifications/NotificationDestination"
import RunHistoryItem from "../components/RunHistory/RunHistoryItem"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty"
import { ScrollArea } from "../components/ui/scroll-area"
import { Skeleton } from "../components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { useNotificationDestinations } from "../hooks/api/useNotificationDestinations"
import { IntegrationType } from "../shared/Integrations"
import { NotificationDestination } from "../shared/Notifications"
import { RunHistoryRecord, RunHistoryStatus } from "../shared/RunHistoryTypes"

const NOTIFICATIONS_PAGE_SIZE = 12

function NotificationsPage() {
    const { notificationDestinations, isError, isValidating, mutate } = useNotificationDestinations()
    const [notificationsPage, setNotificationsPage] = useState(1)

    const totalNotificationPages = Math.max(1, Math.ceil(mockSentNotifications.length / NOTIFICATIONS_PAGE_SIZE))
    const currentNotificationPage = Math.min(notificationsPage, totalNotificationPages)

    const paginatedNotifications = useMemo(() => {
        const startIndex = (currentNotificationPage - 1) * NOTIFICATIONS_PAGE_SIZE
        return mockSentNotifications.slice(startIndex, startIndex + NOTIFICATIONS_PAGE_SIZE)
    }, [currentNotificationPage])

    const handleApproveMock = () => {
        // mock-only callback for UI preview
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                <div className="flex min-h-0 flex-col gap-4">
                    <Card className="min-h-[360px] gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                        <CardContent className="p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-base font-semibold text-foreground">Notification Destinations</p>
                                {!isValidating && notificationDestinations !== undefined && notificationDestinations.length > 0 && <AddNotificationDestination />}
                            </div>
                            {isValidating && <LoadingNotificationChannelList />}
                            {!isValidating && (isError || notificationDestinations === undefined) && <ErrorNotificationChannelList onRetry={() => mutate()} />}
                            {!isValidating && !isError && notificationDestinations !== undefined && <NotificationChannelList notificationDestinations={notificationDestinations} />}
                        </CardContent>
                    </Card>

                    <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-base font-semibold text-foreground">Approvals</p>
                                <Badge variant="outline">{mockPendingApprovals.length}</Badge>
                            </div>
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="space-y-8 py-2">
                                    {mockPendingApprovals.map((run, index) => (
                                        <RunHistoryItem
                                            key={run.id}
                                            run={run}
                                            showStatusBadge={false}
                                            onApprove={handleApproveMock}
                                            showApproveButton={true}
                                            showViewChatButton={true}
                                            className={index === mockPendingApprovals.length - 1 ? "min-w-0 md:mb-0" : "min-w-0 md:mb-6"}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                    <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                        <div className="flex items-center justify-between px-4 pb-2 pt-4">
                            <p className="text-base font-semibold text-foreground">Notifications List</p>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col border-t">
                            <ScrollArea className="min-h-0 flex-1">
                                <Table>
                                    <TableHeader className="bg-muted/35">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="px-4">Event</TableHead>
                                            <TableHead>State</TableHead>
                                            <TableHead className="pr-4">Timestamp</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedNotifications.map(notification => (
                                            <TableRow key={notification.id}>
                                                <TableCell className="px-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{notification.event}</span>
                                                        <span className="text-xs text-muted-foreground">{notification.destination}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <NotificationStatusBadge status={notification.status} />
                                                </TableCell>
                                                <TableCell className="pr-4 text-muted-foreground">{notification.timestamp}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                                <Button variant="outline" size="sm" disabled={currentNotificationPage === 1} onClick={() => setNotificationsPage(page => Math.max(1, page - 1))}>
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentNotificationPage === totalNotificationPages}
                                    onClick={() => setNotificationsPage(page => Math.min(totalNotificationPages, page + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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

type SentNotificationStatus = "delivered" | "failed"

type MockSentNotification = {
    id: string
    event: string
    destination: string
    timestamp: string
    status: SentNotificationStatus
}

function NotificationStatusBadge({ status }: { status: SentNotificationStatus }) {
    const labelMap: Record<SentNotificationStatus, string> = {
        delivered: "Delivered",
        failed: "Failed"
    }

    const classNameMap: Record<SentNotificationStatus, string> = {
        delivered: "border-green-600/40 text-green-600 dark:text-green-400",
        failed: "border-destructive/40 text-destructive"
    }

    return (
        <Badge variant="outline" className={classNameMap[status]}>
            {labelMap[status]}
        </Badge>
    )
}

function minutesAgoISOString(minutesAgo: number) {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
}

const mockPendingApprovals: RunHistoryRecord[] = [
    {
        id: "run_001",
        agentId: "agent_001",
        timestamp: minutesAgoISOString(2),
        trigger: {
            event: "release.ready",
            integration: IntegrationType.GITHUB,
            source: "terse-web",
            title: "Deploy release v2.8.4",
            subheader: "Release Guardian"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Awaiting approval before production deploy."
        },
        status: RunHistoryStatus.AWAITING_APPROVAL,
        isManuallyTriggered: false
    },
    {
        id: "run_002",
        agentId: "agent_002",
        timestamp: minutesAgoISOString(9),
        trigger: {
            event: "invoice.update",
            integration: IntegrationType.ATTIO,
            source: "Finance queue",
            title: "Post customer credit memo",
            subheader: "Finance Ops"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Awaiting approval before sending invoice update."
        },
        status: RunHistoryStatus.AWAITING_APPROVAL,
        isManuallyTriggered: false
    },
    {
        id: "run_003",
        agentId: "agent_003",
        timestamp: minutesAgoISOString(18),
        trigger: {
            event: "ticket.close",
            integration: IntegrationType.ATLASSIAN,
            source: "Support backlog",
            title: "Close stale support issue",
            subheader: "Support Router"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Awaiting approval before issue closure."
        },
        status: RunHistoryStatus.AWAITING_APPROVAL,
        isManuallyTriggered: false
    },
    {
        id: "run_004",
        agentId: "agent_004",
        timestamp: minutesAgoISOString(26),
        trigger: {
            event: "workspace.archive",
            integration: IntegrationType.NOTION,
            source: "Project workspace",
            title: "Archive inactive project",
            subheader: "Workspace Cleaner"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Awaiting approval before archive action."
        },
        status: RunHistoryStatus.AWAITING_APPROVAL,
        isManuallyTriggered: false
    }
]

const mockSentNotifications: MockSentNotification[] = [
    {
        id: "ntf_001",
        event: "approval.requested",
        destination: "#ops-oncall",
        timestamp: "Feb 25, 2026, 10:56 AM",
        status: "delivered"
    },
    {
        id: "ntf_002",
        event: "run.failed",
        destination: "#eng-alerts",
        timestamp: "Feb 25, 2026, 09:58 AM",
        status: "delivered"
    },
    {
        id: "ntf_003",
        event: "approval.reminder",
        destination: "DM · @olivia",
        timestamp: "Feb 25, 2026, 08:45 AM",
        status: "failed"
    },
    {
        id: "ntf_004",
        event: "digest.daily",
        destination: "olivia@terse.io",
        timestamp: "Feb 25, 2026, 08:44 AM",
        status: "failed"
    },
    {
        id: "ntf_005",
        event: "run.summary",
        destination: "#product-updates",
        timestamp: "Feb 25, 2026, 08:24 AM",
        status: "delivered"
    },
    {
        id: "ntf_006",
        event: "approval.resolved",
        destination: "DM · @aaron",
        timestamp: "Feb 25, 2026, 08:02 AM",
        status: "delivered"
    },
    {
        id: "ntf_007",
        event: "run.started",
        destination: "#ops-oncall",
        timestamp: "Feb 25, 2026, 07:51 AM",
        status: "delivered"
    },
    {
        id: "ntf_008",
        event: "run.started",
        destination: "#eng-alerts",
        timestamp: "Feb 25, 2026, 12:10 AM",
        status: "delivered"
    },
    {
        id: "ntf_009",
        event: "approval.requested",
        destination: "#security-updates",
        timestamp: "Feb 24, 2026, 09:49 PM",
        status: "delivered"
    },
    {
        id: "ntf_010",
        event: "approval.requested",
        destination: "DM · @sarah",
        timestamp: "Feb 24, 2026, 09:48 PM",
        status: "delivered"
    },
    {
        id: "ntf_011",
        event: "approval.reminder",
        destination: "DM · @sarah",
        timestamp: "Feb 24, 2026, 09:31 PM",
        status: "delivered"
    },
    {
        id: "ntf_012",
        event: "run.filtered",
        destination: "#ops-oncall",
        timestamp: "Feb 24, 2026, 09:09 PM",
        status: "delivered"
    }
]

export default NotificationsPage
