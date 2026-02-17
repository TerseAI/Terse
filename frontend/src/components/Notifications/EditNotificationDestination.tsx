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
            <DialogContent className="sm:max-w-[760px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-5 border-b bg-gradient-to-r from-muted/60 via-muted/25 to-background">
                    <div className="space-y-1">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <DialogTitle className="text-xl">Edit Notification Destination</DialogTitle>
                            </div>
                            <DialogDescription className="leading-relaxed">Update your Slack notification destination (one channel or one individual DM).</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <NotificationDestinationForm existingDestination={destination} onSuccess={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}
