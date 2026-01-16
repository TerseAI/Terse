import { Bell } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { NotificationDestination } from "../shared/Notifications";
import { NotificationDestinationItem } from "../components/Notifications/NotificationDestination";
import { useNotificationDestinations } from "../hooks/api/useNotificationDestinations";
import { Skeleton } from "../components/ui/skeleton";
import { AddNotificationDestination } from "../components/Notifications/AddNotificationDestination";

function NotificationsPage() {
    const { notificationDestinations, isError, isLoading } = useNotificationDestinations();

    if (isLoading) {
        return <LoadingNotificationChannelList />;
    }

    if (isError || notificationDestinations == undefined) {
        return <ErrorNotificationChannelList />;
    }

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex flex-row justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-foreground">Notification Destinations</h3>
                {notificationDestinations.length > 0 && (
                    <AddNotificationDestination />
                )}
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
                            <Bell className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle>No notification destinations found</EmptyTitle>
                        <EmptyDescription>Add a notification destination to be notified when a background agent makes a change.</EmptyDescription>
                        <AddNotificationDestination />
                    </EmptyHeader>
                </Empty>
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            {notificationDestinations.map((channel) => (
                <NotificationDestinationItem key={channel.id} destination={channel} />
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