import { useSearchParams } from "react-router-dom"

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { Shield, User2, Users } from "lucide-react"

import { useAuth } from "@/modules/auth/context/AuthProvider"
import { UserTable } from "@/modules/users/components/UserManagement"
import { UserProfileWidget } from "@/modules/users/components/UserProfileWidget"
import { UserSecurityWidget } from "@/modules/users/components/UserSecurityWidget"

const tabClass = ({ selected }: { selected: boolean }) =>
    `inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected ? "bg-card text-foreground shadow-[var(--shadow-control)]" : "text-muted-foreground hover:text-foreground"
    }`

const TAB_KEYS = ["profile", "security", "users"] as const

export default function ProfilePage() {
    const { user } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const isAdmin = user?.roles.includes("admin") ?? false

    const visibleTabs = TAB_KEYS.filter(key => {
        if (key === "users") return isAdmin
        return true
    })
    const tabParam = searchParams.get("tab")
    const selectedIndex = Math.max(0, visibleTabs.indexOf(tabParam as (typeof TAB_KEYS)[number]))

    return (
        <div className="flex h-full flex-col p-4 md:p-6">
            <h1 className="mb-5 text-xl font-semibold tracking-tight text-foreground">Account Settings</h1>
            <TabGroup
                selectedIndex={selectedIndex}
                onChange={index => setSearchParams(previous => ({ ...Object.fromEntries(previous), tab: visibleTabs[index] }), { replace: true })}
                className="flex min-h-0 flex-1 flex-col"
            >
                <TabList className="flex w-fit shrink-0 gap-1 rounded-md bg-muted p-1">
                    <Tab className={tabClass}>
                        <User2 className="h-4 w-4" />
                        <span>Profile</span>
                    </Tab>
                    <Tab className={tabClass}>
                        <Shield className="h-4 w-4" />
                        <span>Security</span>
                    </Tab>
                    {isAdmin && (
                        <Tab className={tabClass}>
                            <Users className="h-4 w-4" />
                            <span>User Management</span>
                        </Tab>
                    )}
                </TabList>
                <TabPanels className="flex min-h-0 flex-1 flex-col pt-5">
                    <TabPanel className="flex-1 min-h-0 flex flex-col">
                        <UserProfileWidget />
                    </TabPanel>
                    <TabPanel className="flex-1 min-h-0 flex flex-col">
                        <UserSecurityWidget />
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
