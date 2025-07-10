import { useState, useEffect } from 'react';
import { ActivityEvent } from '../shared/types';
import { ActivityFeedService } from '../services/activityFeed';
import { 
    CodeBracketIcon, 
    ArrowPathIcon, 
    CheckCircleIcon, 
    XCircleIcon,
    ClockIcon,
    UserIcon,
    FolderIcon
} from '@heroicons/react/24/outline';

interface ActivityFeedProps {
    className?: string;
}

export function ActivityFeed({ className = "" }: ActivityFeedProps) {
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadActivities();
    }, []);

    const loadActivities = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await ActivityFeedService.getActivityFeed();
            setActivities(data);
        } catch (err) {
            setError('Failed to load activity feed');
            console.error('Error loading activity feed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getEventIcon = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return <CodeBracketIcon className="w-5 h-5 text-blue-500" />;
            case 'PULL_REQUEST_OPENED':
                return <ArrowPathIcon className="w-5 h-5 text-green-500" />;
            case 'PULL_REQUEST_MERGED':
                return <CheckCircleIcon className="w-5 h-5 text-purple-500" />;
            case 'PULL_REQUEST_CLOSED':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            case 'PULL_REQUEST_UPDATED':
                return <ArrowPathIcon className="w-5 h-5 text-yellow-500" />;
            default:
                return <ClockIcon className="w-5 h-5 text-gray-500" />;
        }
    };

    const getEventColor = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return 'bg-blue-50 border-blue-200';
            case 'PULL_REQUEST_OPENED':
                return 'bg-green-50 border-green-200';
            case 'PULL_REQUEST_MERGED':
                return 'bg-purple-50 border-purple-200';
            case 'PULL_REQUEST_CLOSED':
                return 'bg-red-50 border-red-200';
            case 'PULL_REQUEST_UPDATED':
                return 'bg-yellow-50 border-yellow-200';
            default:
                return 'bg-gray-50 border-gray-200';
        }
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    if (isLoading) {
        return (
            <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Activity Feed</h2>
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
        );
    }

    if (error) {
        return (
            <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
                <div className="p-6">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircleIcon className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load activity feed</h3>
                        <p className="text-gray-500 mb-4">{error}</p>
                        <button
                            onClick={loadActivities}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
                <div className="p-6">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClockIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                        <p className="text-gray-500">
                            Activity will appear here once you start making changes to your repositories.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Activity Feed</h2>
                    <button
                        onClick={loadActivities}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Refresh"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    {activities.map((activity, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-lg border ${getEventColor(activity.event_type)} transition-all hover:shadow-sm`}
                        >
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-1">
                                    {getEventIcon(activity.event_type)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-sm font-medium text-gray-900">
                                            {activity.title}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {formatTimeAgo(activity.created_at)}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                                        <div className="flex items-center space-x-1">
                                            <FolderIcon className="w-4 h-4" />
                                            <span>{activity.github_repository_name}</span>
                                        </div>
                                    </div>
                                    
                                    {activity.ticket_activity_events.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <div className="space-y-2">
                                                {activity.ticket_activity_events.map((ticketEvent, ticketIndex) => (
                                                    <div
                                                        key={ticketIndex}
                                                        className="flex items-center space-x-2 p-2 bg-white rounded border border-gray-200"
                                                    >
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                        <span className="text-sm text-gray-700">
                                                            {ticketEvent.ticket.title}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            ({ticketEvent.event_type.toLowerCase().replace('_', ' ')})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
} 