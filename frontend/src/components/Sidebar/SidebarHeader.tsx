import { ChevronsUpDown, Check } from "lucide-react"

import { useUserOrganizations } from "@/hooks/api/useUserOrganizations"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar"

export function AppSidebarHeader() {
    const { user } = useAuth()
    const { organizations } = useUserOrganizations()

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
            <div className="bg-white text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Avatar>
                    <AvatarImage src="/terse.png" alt="Terse" />
                    <AvatarFallback>CN</AvatarFallback>
                </Avatar>
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">Terse AI</span>
                <span className="text-xs text-muted-foreground">{currentOrgName}</span>
            </div>
            {hasOrgs && <ChevronsUpDown className="ml-auto size-4" />}
        </SidebarMenuButton>
    )

    return (
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    {hasOrgs ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>{headerContent}</DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" className="min-w-56" align="start">
                                {organizations.map(org => (
                                    <DropdownMenuItem key={org.id} onClick={() => handleSwitch(org.id)}>
                                        <span>{org.name}</span>
                                        {org.id === currentOrgId && <Check className="ml-auto size-4" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        headerContent
                    )}
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
    )
}
