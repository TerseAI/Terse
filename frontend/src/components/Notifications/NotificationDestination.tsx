import { useState } from "react";
import { Button } from "../ui/button";
import { EmailNotificationDestination, NotificationDestination, NotificationDestinationType, SlackNotificationDestination } from "../../shared/Notifications";
import { GmailIcon, SlackIcon } from "../icons/IntegrationIcons";
import { Input } from "../ui/input";
import { formatMPIMChannelName } from "../SlackChannelSelector";
import { BackendProvider } from "../../services/backend";
import { mutate } from "swr";
import { notificationDestinationsKey } from "../../shared/InvalidationKeys";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "../ui/item";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function NotificationDestinationItem({ destination }: { destination: NotificationDestination }) {
    const [isEditing, setIsEditing] = useState(false);

    if (isEditing) {
        return <EditNotificationDestination setIsEditing={setIsEditing} />;
    }

    async function deleteDestination() {
        await BackendProvider.deleteNotificationDestination(destination);
        mutate(notificationDestinationsKey());
        toast.info("Notification destination deleted successfully");
    }

    return (
        <Item variant="outline" size="sm" className="rounded-lg">
            <ItemMedia variant="icon" className="size-8 rounded-full bg-primary/10 [&_svg]:text-primary">
                <NotificationDestinationIcon type={destination.type} />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>
                    <NotificationDestinationName destination={destination} />
                </ItemTitle>
                <ItemDescription>
                    {destination.type === NotificationDestinationType.EMAIL ? "Email notifications" : "Slack notifications"}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={deleteDestination} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </ItemActions>
        </Item>
    )
}

export function addNotificationDestination() {
    return (
        <div>
            <h1>Add Notification Destination</h1>
        </div>
    )
}

export function EditNotificationDestination({ setIsEditing }: { setIsEditing: (isEditing: boolean) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2">
                <NotificationDestinationIcon type={NotificationDestinationType.EMAIL} />
                <Input type="email" placeholder="Email" />
            </div>
            <h1>Edit Notification Destination</h1>
            <Button onClick={() => setIsEditing(false)}>Cancel</Button>
        </div>
    )
}

// helper
function NotificationDestinationIcon({ type }: { type: NotificationDestinationType }) {
    switch (type) {
        case NotificationDestinationType.EMAIL:
            return <GmailIcon />
        case NotificationDestinationType.SLACK:
            return <SlackIcon />
    }
}

function NotificationDestinationName({ destination }: { destination: NotificationDestination }) {
    const emailDestination = destination as EmailNotificationDestination;
    const slackDestination = destination as SlackNotificationDestination;
    if (emailDestination.email) {
        return <>{emailDestination.email}</>
    }
    if (slackDestination.slackChannelName) {
        return <>#{formatMPIMChannelName(slackDestination.slackChannelName)}</>
    }
    return <>Unknown destination</> 
}