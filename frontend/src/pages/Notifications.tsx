import { Inbox, PlusIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { NotificationDestination } from "../shared/Notifications";
import { NotificationDestinationItem } from "../components/Notifications/NotificationDestination";
import { useNotificationDestinations } from "../hooks/api/useNotificationDestinations";
import { Skeleton } from "../components/ui/skeleton";

function NotificationsPage() {
    const { notificationDestinations, isError, isValidating } = useNotificationDestinations();

    if (isValidating) {
        return <LoadingNotificationChannelList />;
    }

    if (isError || notificationDestinations == undefined) {
        return <ErrorNotificationChannelList />;
    }

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex flex-row justify-between items-center">
                <h3 className="text-xl font-bold text-foreground mb-4">Notification Channels</h3>
                <Button variant="outline">
                    <PlusIcon />
                    Add Notification Channel
                </Button>
            </div>

            <NotificationChannelList notificationDestinations={notificationDestinations} />
        </div>
    )
}

function NotificationChannelList({ notificationDestinations }: { notificationDestinations: NotificationDestination[] }) {
    if (notificationDestinations.length == 0) {
        return (
            <div className="flex flex-col gap-4">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Inbox className="text-[theme(--color-primary)]" />
                        </EmptyMedia>
                        <EmptyTitle>No notification channels found</EmptyTitle>
                        <EmptyDescription>Add a notification channel to be notified when a background agent makes a change.</EmptyDescription>
                        <Button variant="outline">
                            <PlusIcon />
                            Add Notification Channel
                        </Button>
                    </EmptyHeader>
                </Empty>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            {notificationDestinations.map((channel) => (
                <NotificationDestinationItem key={channel.id} />
            ))}
        </div>
    )
}

function LoadingNotificationChannelList() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
        </div>
    )
}

function ErrorNotificationChannelList() {
    return (
        <div className="flex flex-col gap-4">
            <p>Error loading notification channels</p>
        </div>
    )
}

export default NotificationsPage;