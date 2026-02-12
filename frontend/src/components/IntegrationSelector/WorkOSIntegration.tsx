import { AlertTriangleIcon, CheckIcon } from "lucide-react"

import { WorkOSIcon } from "@/components/icons/IntegrationIcons"
import { useWorkOSIntegrations } from "@/hooks/api/useWorkOSIntegrations"
import { WorkOSInputConfig } from "@/shared/Configs"

import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"

import { InputConfigSelectorProps } from "./types"

const WORKOS_EVENT_TYPES = [
    { value: "user.created", label: "User Created", description: "A new user signs up to your app" },
    { value: "user.updated", label: "User Updated", description: "A user's profile is changed" },
    { value: "user.deleted", label: "User Deleted", description: "A user is removed" },
    { value: "organization_membership.created", label: "Membership Created", description: "A user joins an organization" },
    { value: "organization_membership.updated", label: "Membership Updated", description: "A user's role or membership changes" },
    { value: "organization_membership.deleted", label: "Membership Deleted", description: "A user leaves an organization" }
]

export function WorkOSIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useWorkOSIntegrations()
    const existingConfig = input.config as WorkOSInputConfig | undefined
    const selectedEventTypes = existingConfig?.eventTypes ?? []
    const integrationId = existingConfig?.integrationId ?? integrations[0]?.id

    if (variant === "card") {
        if (!selectedEventTypes.length) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select event types
                </div>
            )
        }
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-3 text-primary shrink-0">
                    <WorkOSIcon />
                </div>
                {selectedEventTypes.length} event type{selectedEventTypes.length !== 1 ? "s" : ""}
            </div>
        )
    }

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading...</div>
    }

    if (integrations.length === 0) {
        return (
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No WorkOS integration connected. Connect your WorkOS account in the Integrations settings first.</p>
            </div>
        )
    }

    const handleToggleEvent = (eventType: string, checked: boolean) => {
        const newEventTypes = checked ? [...selectedEventTypes, eventType] : selectedEventTypes.filter(e => e !== eventType)
        setConfig(new WorkOSInputConfig(integrationId, newEventTypes))
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <Label className="text-sm font-medium">Event Types</Label>
                <p className="text-xs text-muted-foreground">Select the WorkOS events that should trigger this agent.</p>
            </div>

            <div className="space-y-2">
                {WORKOS_EVENT_TYPES.map(event => (
                    <label key={event.value} className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
                        <Checkbox checked={selectedEventTypes.includes(event.value)} onCheckedChange={checked => handleToggleEvent(event.value, !!checked)} className="mt-0.5" />
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">{event.label}</div>
                            <div className="text-xs text-muted-foreground">{event.description}</div>
                        </div>
                    </label>
                ))}
            </div>

            {selectedEventTypes.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                    <CheckIcon className="size-3" />
                    {selectedEventTypes.length} event type{selectedEventTypes.length !== 1 ? "s" : ""} selected
                </div>
            )}
        </div>
    )
}
