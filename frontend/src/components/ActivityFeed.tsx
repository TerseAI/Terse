import React, { useEffect, useState } from 'react';
import GitHubAvatar from './GithubPhoto';
import { ActivityEvent } from '../shared/types';
import { ActivityFeedService } from '../services/activityFeed';
import { 
    CodeBracketIcon, 
    ArrowPathIcon, 
    CheckCircleIcon, 
    XCircleIcon,
    ClockIcon,
    FolderIcon
} from '@heroicons/react/24/outline';

// Ticket Activity Events Component
const TicketActivityEvents: React.FC<{ ticketEvents: ActivityEvent['ticket_activity_events'] }> = ({ ticketEvents }) => {
    if (ticketEvents.length === 0) return null;

    return (
        <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="space-y-2">
                {ticketEvents.map((ticketEvent, ticketIndex) => (
                    <div
                        key={ticketIndex}
                        className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm font-normal text-gray-700 flex-1">
                            {ticketEvent.ticket.title}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {ticketEvent.event_type.toLowerCase().replace('_', ' ')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Activity Event Item Component
const ActivityEventItem: React.FC<{ activity: ActivityEvent }> = ({ activity }) => {
    const getEventIcon = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return <CodeBracketIcon className="w-4 h-4 text-blue-600" />;
            case 'PULL_REQUEST_OPENED':
                return <ArrowPathIcon className="w-4 h-4 text-green-600" />;
            case 'PULL_REQUEST_MERGED':
                return <CheckCircleIcon className="w-4 h-4 text-purple-600" />;
            case 'PULL_REQUEST_CLOSED':
                return <XCircleIcon className="w-4 h-4 text-red-600" />;
            case 'PULL_REQUEST_UPDATED':
                return <ArrowPathIcon className="w-4 h-4 text-yellow-600" />;
            default:
                return <ClockIcon className="w-4 h-4 text-gray-600" />;
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

    return (
        <div className={`p-4 rounded-lg border ${getEventColor(activity.event_type)} transition-all hover:shadow-sm`}>
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm">
                            <GitHubAvatar username={activity.github_repository_owner_id} size={48} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-gray-200">
                            {getEventIcon(activity.event_type)}
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                            {activity.github_repository_name}
                        </span>
                        <span className="text-xs text-gray-500">
                            {formatTimeAgo(activity.created_at)}
                        </span>
                    </div>
                    
                    <div className="text-sm font-normal text-gray-700 mb-3">
                        {activity.title}
                    </div>
                    
                    {activity.ticket_activity_events.length > 0 && (
                        <TicketActivityEvents ticketEvents={activity.ticket_activity_events} />
                    )}
                </div>
            </div>
        </div>
    );
};

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
                        <ActivityEventItem key={index} activity={activity} />
                    ))}
                </div>
            </div>
        </div>
    );
} 