import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { Building2, Monitor, Shield, User2, Users } from "lucide-react"

import { OrganizationSwitcherWidget } from "@/components/OrganizationSwitcher/OrganizationSwitcherWidget"
import { UserTable } from "@/components/UserManagement/UserManagement"
import { UserProfileWidget } from "@/components/UserProfile/UserProfileWidget"
import { UserSecurityWidget } from "@/components/UserProfile/UserSecurityWidget"
import { UserSessionsWidget } from "@/components/UserProfile/UserSessionsWidget"
import { useUserOrganizations } from "@/hooks/api/useUserOrganizations"
import { useAuth } from "@/services/auth"

const tabClass = ({ selected }: { selected: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${
        selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
    }`

export default function ProfilePage() {
    const { user } = useAuth()
    const isAdmin = user?.roles.includes("admin") ?? false
    const { organizations } = useUserOrganizations()
    const hasMultipleOrgs = organizations.length > 1

    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-5">Account Settings</h1>
            <TabGroup className="flex flex-col flex-1 min-h-0">
                <TabList className="flex gap-2 border-b border-input shrink-0">
                    <Tab className={tabClass}>
                        <User2 className="h-4 w-4" />
                        <span>Profile</span>
                    </Tab>
                    <Tab className={tabClass}>
                        <Monitor className="h-4 w-4" />
                        <span>Sessions</span>
                    </Tab>
                    <Tab className={tabClass}>
                        <Shield className="h-4 w-4" />
                        <span>Security</span>
                    </Tab>
                    {hasMultipleOrgs && (
                        <Tab className={tabClass}>
                            <Building2 className="h-4 w-4" />
                            <span>Organizations</span>
                        </Tab>
                    )}
                    {isAdmin && (
                        <Tab className={tabClass}>
                            <Users className="h-4 w-4" />
                            <span>User Management</span>
                        </Tab>
                    )}
                </TabList>
                <TabPanels className="flex-1 min-h-0 flex flex-col pt-4">
                    <TabPanel className="flex-1 min-h-0 flex flex-col">
                        <UserProfileWidget />
                    </TabPanel>
                    <TabPanel className="flex-1 min-h-0 flex flex-col">
                        <UserSessionsWidget />
                    </TabPanel>
                    <TabPanel className="flex-1 min-h-0 flex flex-col">
                        <UserSecurityWidget />
                    </TabPanel>
                    {hasMultipleOrgs && (
                        <TabPanel className="flex-1 min-h-0 flex flex-col">
                            <OrganizationSwitcherWidget />
                        </TabPanel>
                    )}
                    {isAdmin && (
                        <TabPanel className="flex-1 min-h-0 flex flex-col">
                            <UserTable />
                        </TabPanel>
                    )}
                </TabPanels>
            </TabGroup>
        </div>
    )
}
