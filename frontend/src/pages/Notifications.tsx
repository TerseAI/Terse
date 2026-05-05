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
import { AddNotificationDestination } from "@/components/Notifications/AddNotificationDestination"
import ApprovalRequestItem from "@/components/Notifications/ApprovalRequestItem"
import { NotificationDestinationItem } from "@/components/Notifications/NotificationDestination"
import { SlackIcon } from "@/components/icons/IntegrationIcons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NOTIFICATION_ACTION_OPTIONS } from "@/constants/notificationActions"
import { useNotificationDestinations } from "@/hooks/api/useNotificationDestinations"
import { useNotificationSettings } from "@/hooks/api/useNotificationSettings"
import { usePendingApprovals } from "@/hooks/api/usePendingApprovals"
import { useSentNotifications } from "@/hooks/api/useSentNotifications"
import { useRunHistoryChatDrawer } from "@/services/RunHistoryChatDrawerContext"
import { BackendProvider } from "@/services/backend"
import { sendToolApprovalResponse } from "@/socket"
import { formatRelativeTime } from "@/utility/timeUtils"

import StatusBadge from "../components/StatusBadge"
import { Form, FormControl, FormField, FormItem, FormLabel } from "../components/ui/form"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"

const NOTIFICATIONS_PAGE_SIZE = 12
const ALL_RUN_STATUSES = Object.values(RunHistoryStatus) as RunHistoryStatus[]
const APPROVAL_FILTER_OPTIONS: Array<{ value: ApprovalRequestFilter; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" }
]
const ADD_DESTINATION_QUERY_PARAM = "addDestination"
const SENT_NOTIFICATION_ROW_HEIGHT_CLASS = "h-[5.5rem]"

function NotificationsPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { notificationDestinations, isError: isDestinationsError, isValidating: isDestinationsValidating, mutate: mutateDestinations } = useNotificationDestinations()
    const [approvalFilter, setApprovalFilter] = useState<ApprovalRequestFilter>("pending")
    const { approvals, isLoading: isApprovalsLoading, isError: isApprovalsError, mutate: mutateApprovals } = usePendingApprovals({ status: approvalFilter })
    const [notificationsPage, setNotificationsPage] = useState(1)
    const [isAddDestinationDialogOpen, setIsAddDestinationDialogOpen] = useState(false)
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
        <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-x-auto overflow-y-auto px-2">
            <div className="grid min-h-0 min-w-0 gap-4 lg:flex-1 lg:min-w-272 lg:grid-cols-2">
                <div className="flex min-h-0 min-w-0 flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        {hasDestinationData && (
                            <AddNotificationDestination
                                trigger={<button type="button" className="hidden" aria-hidden="true" tabIndex={-1} />}
                                externalOpen={isAddDestinationDialogOpen}
                                onExternalOpenChange={setIsAddDestinationDialogOpen}
                            />
                        )}
                        <Card className="min-h-[8rem] gap-0 overflow-hidden border-border/60 bg-card py-0">
                            <CardContent className="p-4">
                                <Tabs defaultValue="destinations" className="w-full">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-base font-semibold text-foreground">Notification Defaults</p>
                                        <TabsList className="h-auto">
                                            <TabsTrigger value="destinations">Destination</TabsTrigger>
                                            <TabsTrigger value="types">Notification Types</TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value="destinations" className="mt-0">
                                        {shouldShowDestinationsLoading && <LoadingNotificationChannelList />}
                                        {!shouldShowDestinationsLoading && (isDestinationsError || notificationDestinations === undefined) && (
                                            <ErrorNotificationChannelList onRetry={() => mutateDestinations()} />
                                        )}
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
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden border-border/60 bg-card/35 py-0 backdrop-blur-sm">
                            <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
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
                                {isApprovalsLoading && <LoadingApprovalsList />}

                                {!isApprovalsLoading && isApprovalsError && <ErrorApprovalsList onRetry={() => mutateApprovals()} />}

                                {!isApprovalsLoading && !isApprovalsError && approvals.length === 0 && <EmptyApprovalsList />}

                                {!isApprovalsLoading && !isApprovalsError && approvals.length > 0 && (
                                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
                                        {approvals.map(approval => (
                                            <ApprovalRequestItem key={approval.id} approval={approval} onAction={deepLink => void handleDeepLinkAction(deepLink)} />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:h-full">
                    <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 lg:h-full">
                        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                            <div className="flex items-center justify-between gap-2 px-4 py-3">
                                <p className="text-base font-semibold text-foreground">Sent Notifications</p>
                                <div className="flex items-center gap-2">
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
                            </div>
                            <div className="flex min-h-0 flex-1 flex-col">
                                <ScrollArea className="min-h-0 flex-1">
                                    <Table className="w-full table-fixed">
                                        <colgroup>
                                            <col />
                                            <col style={{ width: "7rem" }} />
                                            <col style={{ width: "9rem" }} />
                                        </colgroup>
                                        <TableHeader className="bg-muted/20">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="px-4">Event</TableHead>
                                                <TableHead className="px-3 text-center">Status</TableHead>
                                                <TableHead className="px-4 text-center">Timestamp</TableHead>
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
            return "Weekly agent review"
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
        <TableRow key={notification.id} className={SENT_NOTIFICATION_ROW_HEIGHT_CLASS}>
            <TableCell className="px-4 py-3 align-middle">
                <div className="min-w-0">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-medium text-foreground">{formatEventType(notification.eventType)}</span>
                        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
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
                        </span>
                        {shouldShowAgent && <span className="truncate text-xs text-muted-foreground">Agent: {normalizedAgentName}</span>}
                    </div>
                </div>
            </TableCell>
            <TableCell className="px-3 py-3 align-middle">
                <div className="flex items-center justify-center">
                    <NotificationStatusBadge status={notification.status} />
                </div>
            </TableCell>
            <TableCell className="px-4 py-3 text-center align-middle whitespace-nowrap text-muted-foreground">{formatRelativeTime(notification.sentAt)}</TableCell>
        </TableRow>
    )
}

function LoadingSentNotificationsRows() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`loading-${index}`} className={SENT_NOTIFICATION_ROW_HEIGHT_CLASS}>
                    <TableCell className="px-4 py-3 align-middle">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-36" />
                        </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 align-middle">
                        <div className="flex items-center justify-center">
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center align-middle">
                        <div className="flex items-center justify-center">
                            <Skeleton className="h-4 w-20" />
                        </div>
                    </TableCell>
                </TableRow>
            ))}
        </>
    )
}

function ErrorSentNotificationsRow() {
    return (
        <TableRow>
            <TableCell className="px-4 py-6 text-sm text-danger" colSpan={3}>
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
            toast.success(applyToAllAgents ? "Notification settings updated for all agents" : "Notification settings updated")
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
                                        placeholder="Select event types..."
                                        searchPlaceholder="Search types..."
                                        emptyMessage="No types found."
                                        displayText={count => (count > 0 ? `${count} selected` : "Select event types...")}
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
                                        Receive weekly agent improvement email
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
                        <DialogTitle>Apply to all agents?</DialogTitle>
                        <DialogDescription>Do you want to apply these default notification event changes to every agent in your organization?</DialogDescription>
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
                                "Apply to all agents"
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
