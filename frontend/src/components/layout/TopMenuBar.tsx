import { useAuth } from "../../services/auth";

interface TopMenuBarProps {
    className?: string;
}

export function TopMenuBar({ className = "" }: TopMenuBarProps) {
    const { user, logout } = useAuth();

    return (
        <div className={`bg-white border-b border-gray-200 ${className}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                    <div className="flex items-center space-x-3">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">Vectra AI</h1>
                            <p className="text-sm text-gray-600">Dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{user?.display_name}</span>
                        <button
                            onClick={logout}
                            className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 