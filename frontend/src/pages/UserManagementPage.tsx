import { UserTable } from "../components/UserManagement/UserManagement";


export default function UserManagementPage() {
    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-5">User Management</h1>
            <UserTable />
        </div>
    )
}