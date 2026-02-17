import { useState } from "react"

import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { mutate } from "swr"

import { BackendProvider } from "../../services/backend"
import { notificationDestinationsKey } from "../../shared/InvalidationKeys"
import { EmailNotificationDestination, NotificationDestination, NotificationDestinationType, SlackNotificationDestination } from "../../shared/Notifications"
import { formatMPIMChannelName } from "../SlackChannelSelector"
import { GmailIcon, SlackIcon } from "../icons/IntegrationIcons"
import { Button } from "../ui/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "../ui/item"

import { EditNotificationDestinationDialog } from "./EditNotificationDestination"

export function NotificationDestinationItem({ destination }: { destination: NotificationDestination }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

    async function deleteDestination() {
        await BackendProvider.deleteNotificationDestination(destination)
        mutate(notificationDestinationsKey())
        toast.info("Notification destination deleted successfully")
    }

    return (
        <>
            <Item variant="outline" size="sm" className="rounded-lg">
                <ItemMedia variant="icon" className="size-8 rounded-full bg-primary/10 [&_svg]:text-primary">
                    <NotificationDestinationIcon type={destination.type} />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>
                        <NotificationDestinationName destination={destination} />
                    </ItemTitle>
                    <ItemDescription>
                        {destination.type === NotificationDestinationType.EMAIL ? "Email notifications" : getSlackDestinationDescription(destination as SlackNotificationDestination)}
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Button variant="ghost" size="icon" onClick={() => setIsEditDialogOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={deleteDestination} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </ItemActions>
            </Item>

            <EditNotificationDestinationDialog destination={destination} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
        </>
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
    const emailDestination = destination as EmailNotificationDestination
    const slackDestination = destination as SlackNotificationDestination
    if (emailDestination.email) {
        return <>{emailDestination.email}</>
    }
    if (slackDestination.slackUserName) {
        return <>DM: {slackDestination.slackUserName}</>
    }
    if (slackDestination.slackUserId) {
        return <>DM: {slackDestination.slackUserId}</>
    }
    if (slackDestination.slackChannelName) {
        if (slackDestination.slackChannelId?.startsWith("D")) {
            return <>DM: {slackDestination.slackChannelName}</>
        }
        return <>#{formatMPIMChannelName(slackDestination.slackChannelName)}</>
    }
    return <>Unknown destination</>
}

function getSlackDestinationDescription(destination: SlackNotificationDestination): string {
    if (destination.slackUserId || destination.slackChannelId?.startsWith("D")) {
        return "Slack direct message notifications"
    }

    return "Slack channel notifications"
}
