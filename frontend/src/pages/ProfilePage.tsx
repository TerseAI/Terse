import { useSearchParams } from "react-router-dom"

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { Key, Monitor, Shield, User2, Users } from "lucide-react"

import { UserTable } from "@/components/UserManagement/UserManagement"
import { ApiTokensWidget } from "@/components/UserProfile/ApiTokensWidget"
import { UserProfileWidget } from "@/components/UserProfile/UserProfileWidget"
import { UserSecurityWidget } from "@/components/UserProfile/UserSecurityWidget"
import { UserSessionsWidget } from "@/components/UserProfile/UserSessionsWidget"
import { useAuth } from "@/services/auth"

const tabClass = ({ selected }: { selected: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${
        selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
    }`

const TAB_INDICES = { profile: 0, sessions: 1, security: 2, "api-tokens": 3, users: 4 } as const

export default function ProfilePage() {
    const { user } = useAuth()
    const [searchParams] = useSearchParams()
    const isAdmin = user?.roles.includes("admin") ?? false

    const tabParam = searchParams.get("tab") as keyof typeof TAB_INDICES | null
    const defaultIndex = tabParam && TAB_INDICES[tabParam] !== undefined ? TAB_INDICES[tabParam] : 0

    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-5">Account Settings</h1>
            <TabGroup defaultIndex={defaultIndex} className="flex flex-col flex-1 min-h-0">
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
                    <Tab className={tabClass}>
                        <Key className="h-4 w-4" />
                        <span>API Tokens</span>
                    </Tab>
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
                    <TabPanel className="flex-1 min-h-0 flex flex-col">
                        <ApiTokensWidget />
                    </TabPanel>
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
