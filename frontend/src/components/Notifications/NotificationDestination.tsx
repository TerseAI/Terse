import { useState } from "react";
import { Button } from "../ui/button";
import { NotificationDestinationType } from "../../shared/Notifications";
import { GmailIcon, SlackIcon } from "../icons/IntegrationIcons";
import { Input } from "../ui/input";

export function NotificationDestinationItem() {
    const [isEditing, setIsEditing] = useState(false);

    if (isEditing) {
        return <EditNotificationDestination setIsEditing={setIsEditing} />;
    }

    return (
        <div>
            <h1>Notification Destination</h1>
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
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