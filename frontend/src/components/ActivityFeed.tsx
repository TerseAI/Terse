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
    UserIcon,
} from '@heroicons/react/24/outline';

// Utility function for formatting time
const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

// Enhanced Activity Event Item Component
const EnhancedActivityEventItem: React.FC<{ activity: ActivityEvent }> = ({ activity }) => {
    const getEventIcon = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return <CodeBracketIcon className="w-5 h-5 text-blue-600" />;
            case 'PULL_REQUEST_OPENED':
                return <ArrowPathIcon className="w-5 h-5 text-green-600" />;
            case 'PULL_REQUEST_MERGED':
                return <CheckCircleIcon className="w-5 h-5 text-purple-600" />;
            case 'PULL_REQUEST_CLOSED':
                return <XCircleIcon className="w-5 h-5 text-red-600" />;
            case 'PULL_REQUEST_UPDATED':
                return <ArrowPathIcon className="w-5 h-5 text-yellow-600" />;
            default:
                return <ClockIcon className="w-5 h-5 text-gray-600" />;
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

    const getEventTypeLabel = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return 'Commit';
            case 'PULL_REQUEST_OPENED':
                return 'PR Opened';
            case 'PULL_REQUEST_MERGED':
                return 'PR Merged';
            case 'PULL_REQUEST_CLOSED':
                return 'PR Closed';
            case 'PULL_REQUEST_UPDATED':
                return 'PR Updated';
            default:
                return eventType;
        }
    };

    return (
        <div className={`p-6 rounded-xl border ${getEventColor(activity.event_type)} transition-all hover:shadow-lg`}>
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm">
                            <GitHubAvatar username={activity.github_repository_owner_id} size={48} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                            {getEventIcon(activity.event_type)}
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-900">
                                {activity.github_repository_owner_id}/{activity.github_repository_name}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {getEventTypeLabel(activity.event_type)}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                                {formatTimeAgo(activity.created_at)}
                            </span>
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">
                                {activity.github_repository_owner_id}
                            </span>
                        </div>
                    </div>
                    
                    {/* Title and Summary */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {activity.title}
                    </h3>
                    
                    {/* Ticket Activity Events */}
                    {activity.ticket_activity_events.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-700">Related Tickets</span>
                            </div>
                            <div className="space-y-2">
                                {activity.ticket_activity_events.map((ticketEvent, index) => (
                                    <div key={index} className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                                        <span className="text-xs font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                            {ticketEvent.ticket.id}
                                        </span>
                                        <span className="text-sm text-gray-700 flex-1">{ticketEvent.ticket.title}</span>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            {ticketEvent.event_type.toLowerCase().replace('_', ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-start space-x-4 p-6 border border-gray-200 rounded-xl">
                                <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                                <div className="flex-1 space-y-3">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
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
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={loadActivities}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Refresh"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div className="space-y-6">
                    {activities.map((activity, index) => (
                        <EnhancedActivityEventItem key={index} activity={activity} />
                    ))}
                </div>
            </div>
        </div>
    );
} 