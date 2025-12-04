import { useState } from "react";
import { Button } from "../ui/button";
import { EmailNotificationDestination, NotificationDestination, NotificationDestinationType, SlackNotificationDestination } from "../../shared/Notifications";
import { GmailIcon, SlackIcon } from "../icons/IntegrationIcons";
import { Input } from "../ui/input";
import { formatMPIMChannelName } from "../SlackChannelSelector";
import { BackendProvider } from "../../services/backend";
import { mutate } from "swr";
import { notificationDestinationsKey } from "../../shared/InvalidationKeys";

export function NotificationDestinationItem({ destination }: { destination: NotificationDestination }) {
    const [isEditing, setIsEditing] = useState(false);

    if (isEditing) {
        return <EditNotificationDestination setIsEditing={setIsEditing} />;
    }

    async function deleteDestination() {
        await BackendProvider.deleteNotificationDestination(destination);
        mutate(notificationDestinationsKey());
    }

    return (
        <div>
            <NotificationDestinationIcon type={destination.type} />
            <NotificationDestinationName destination={destination} />
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
            <Button variant="destructive" onClick={deleteDestination}>Delete</Button>
        </div>
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
            return <div className="w-5 h-5"><GmailIcon /></div>
        case NotificationDestinationType.SLACK:
            return <div className="w-5 h-5"><SlackIcon /></div>
    }
}

function NotificationDestinationName({ destination }: { destination: NotificationDestination }) {
    const emailDestination = destination as EmailNotificationDestination;
    const slackDestination = destination as SlackNotificationDestination;
    if (emailDestination.email) {
        return <span>{emailDestination.email}</span>
    }
    if (slackDestination.slackChannelName) {
        return <span>{formatMPIMChannelName(slackDestination.slackChannelName)}</span>
    }
    return <span>Unknown destination</span> 
}