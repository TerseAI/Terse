export function LoadingDashboard() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Activity Feed Skeleton */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                                <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Skeleton */}
            <div className="lg:col-span-1 space-y-6">
                {/* System Status Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse"></div>
                                    <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                                </div>
                            </div>
                            <div className="mt-2">
                                <div className="h-3 bg-gray-200 rounded w-48 animate-pulse"></div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse"></div>
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrations Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
                    
                    <div className="space-y-4">
                        {/* GitHub Skeleton */}
                        <div className="border-b border-gray-100 pb-4">
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-48 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                        </div>

                        {/* Ticketing System Skeleton */}
                        <div className="border-b border-gray-100 pb-4">
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-56 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                        </div>

                        {/* Slack Skeleton */}
                        <div>
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-40 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Privacy Notice Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
} 