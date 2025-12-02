import { Inbox, PlusIcon } from "lucide-react";
import { GmailIcon, SlackIcon } from "@/components/icons/IntegrationIcons";
import { Card, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { NotificationChannel, NotificationChannelType } from "@/shared/Notifications";

function NotificationsPage() {
    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex flex-row justify-between items-center">
                <h3 className="text-xl font-bold text-foreground mb-4">Notification Channels</h3>
                <Button variant="outline">
                    <PlusIcon />
                    Add Notification Channel
                </Button>
            </div>

            <NotificationChannelList />
        </div>
    )
}

function NotificationChannelIcon({ type }: { type: NotificationChannelType }) {
    switch (type) {
        case NotificationChannelType.EMAIL:
            return <div className="w-5 h-5"><GmailIcon /></div>
        case NotificationChannelType.SLACK:
            return <div className="w-5 h-5"><SlackIcon /></div>
    }
}

const mockNotificationChannels: NotificationChannel[] = [
    {
        id: 1,
        type: NotificationChannelType.EMAIL,
    },
    {
        id: 2,
        type: NotificationChannelType.SLACK,
    },
]

function NotificationChannelList() {
    if (mockNotificationChannels.length == 0) {
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
            {mockNotificationChannels.map((channel) => (
                <NotificationChannelItem key={channel.id} channel={channel} />
            ))}
        </div>
    )
}

function NotificationChannelItem({ channel }: { channel: NotificationChannel }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <NotificationChannelIcon type={channel.type} />
                    {channel.type === NotificationChannelType.EMAIL ? "Email" : "Slack"}
                </CardTitle>
            </CardHeader>
        </Card>
    )
}

export default NotificationsPage;