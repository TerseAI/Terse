import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Check, ChevronsUpDown, Settings, Users } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { BackendProvider } from "@/lib/http"
import { useAuth } from "@/modules/auth/context/AuthProvider"
import { EditOrganizationDialog } from "@/modules/organizations/components/EditOrganizationDialog"
import { OrgLogo } from "@/modules/organizations/components/OrgLogo"
import { useUserOrganizations } from "@/modules/users/api/useUserOrganizations"

export function AppSidebarHeader() {
    const { user } = useAuth()
    const { organizations } = useUserOrganizations()
    const navigate = useNavigate()
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const isAdmin = user?.roles.includes("admin") ?? false

    const currentOrgName = user?.organizationName || "Organization"
    const currentOrgId = user?.organizationId
    const hasOrgs = organizations.length > 0

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
            <OrgLogo organizationId={currentOrgId} alt={currentOrgName} />
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
                                            <OrgLogo organizationId={org.id} alt={org.name} size="sm" className="mr-2" />
                                            <span>{org.name}</span>
                                            {org.id === currentOrgId && <Check className="ml-auto size-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                                        <Settings className="size-4 mr-2" />
                                        <span>Edit Organization</span>
                                    </DropdownMenuItem>
                                    {isAdmin && (
                                        <DropdownMenuItem onClick={() => navigate(FrontendRoutes.USER_MANAGEMENT)}>
                                            <Users className="size-4 mr-2" />
                                            <span>User Management</span>
                                        </DropdownMenuItem>
                                    )}
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
