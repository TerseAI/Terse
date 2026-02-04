import { useState } from "react"

import { Check, ChevronsUpDown, Settings } from "lucide-react"

import { useOrgLogo } from "@/hooks/api/useOrgLogo"
import { useUserOrganizations } from "@/hooks/api/useUserOrganizations"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"

import { EditOrganizationDialog } from "../UserManagement/EditOrganizationDialog"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar"

export function AppSidebarHeader() {
    const { user } = useAuth()
    const { organizations } = useUserOrganizations()
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const currentOrgName = user?.organizationName || "Organization"
    const currentOrgId = user?.organizationId
    const hasOrgs = organizations.length > 0

    const { logoUrl } = useOrgLogo(currentOrgId)

    const handleSwitch = async (organizationId: string) => {
        if (organizationId === currentOrgId) return

        try {
            const response = await BackendProvider.switchOrganization(organizationId)
            if (response.redirectUrl) {
                window.location.href = response.redirectUrl
            } else {
                window.location.reload()
            }
        } catch (err: unknown) {
            const e = err as { redirectUrl?: string }
            if (e?.redirectUrl) {
                window.location.href = e.redirectUrl
            } else {
                window.location.reload()
            }
        }
    }

    const headerContent = (
        <SidebarMenuButton size="lg" className={hasOrgs ? "cursor-pointer" : "cursor-default"}>
            <div className="bg-white text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Avatar>
                    <AvatarImage src={logoUrl || "/terse.png"} alt={currentOrgName} />
                    <AvatarFallback>{currentOrgName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">{currentOrgName}</span>
                <span className="text-xs text-muted-foreground">Terse AI</span>
            </div>
            {hasOrgs && <ChevronsUpDown className="ml-auto size-4" />}
        </SidebarMenuButton>
    )

    return (
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    {hasOrgs ? (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>{headerContent}</DropdownMenuTrigger>
                                <DropdownMenuContent side="bottom" className="min-w-56" align="start">
                                    {organizations.map(org => (
                                        <DropdownMenuItem key={org.id} onClick={() => handleSwitch(org.id)}>
                                            <span>{org.name}</span>
                                            {org.id === currentOrgId && <Check className="ml-auto size-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                                        <Settings className="size-4 mr-2" />
                                        <span>Edit Organization</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <EditOrganizationDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} />
                        </>
                    ) : (
                        headerContent
                    )}
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
    )
}
