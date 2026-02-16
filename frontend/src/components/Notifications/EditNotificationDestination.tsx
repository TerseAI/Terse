import { NotificationDestination } from "../../shared/Notifications"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"

import { NotificationDestinationForm } from "./NotificationDestinationForm"

interface EditNotificationDestinationProps {
    destination: NotificationDestination
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditNotificationDestinationDialog({ destination, open, onOpenChange }: EditNotificationDestinationProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Notification Destination</DialogTitle>
                    <DialogDescription>Update your Slack notification destination (one channel or one individual DM).</DialogDescription>
                </DialogHeader>
                <NotificationDestinationForm existingDestination={destination} onSuccess={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}
