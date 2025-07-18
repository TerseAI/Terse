import {
    ArrowPathIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClockIcon,
    CodeBracketIcon,
    UserIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { ActivityFeedService } from '../services/activityFeed';
import { ActivityEvent } from '../shared/types';
import GitHubAvatar from './GithubPhoto';

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
    const [expandedSubActivities, setExpandedSubActivities] = useState<Set<number>>(new Set());
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
                return 'push to remote';
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

    const toggleSubActivity = (index: number) => {
        const newExpanded = new Set(expandedSubActivities);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSubActivities(newExpanded);
    };

    return (
        <div className={`p-4 rounded-lg border ${getEventColor(activity.event_type)} transition-all`}>
            <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm">
                            <GitHubAvatar username={activity.github_repository_owner_id} size={40} />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                            <div className="w-3 h-3 flex items-center justify-center">
                                {getEventIcon(activity.event_type)}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                                {activity.github_repository_name}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {getEventTypeLabel(activity.event_type)}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                                {formatTimeAgo(activity.created_at)}
                            </span>
                            <UserIcon className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">
                                {activity.github_repository_owner_id}
                            </span>
                        </div>
                    </div>
                    
                    {/* Title and Summary */}
                    <h3 className="text-base font-semibold text-gray-900 mb-2">
                        {activity.title}
                    </h3>
                    
                    {/* Sub Activities */}
                    {activity.sub_activities.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {activity.sub_activities.map((subActivity, index) => (
                                <div key={index} className="bg-gray-50 rounded-md border border-gray-100">
                                    <div className="p-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-gray-700 flex-1">{subActivity.summary}</p>
                                            {subActivity.commits.length > 0 && (
                                                <button
                                                    onClick={() => toggleSubActivity(index)}
                                                    className="ml-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                                >
                                                    {expandedSubActivities.has(index) ? (
                                                        <>
                                                            <ChevronDownIcon className="w-4 h-4" />
                                                            Hide commits
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronRightIcon className="w-4 h-4" />
                                                            Show {subActivity.commits.length} commit{subActivity.commits.length !== 1 ? 's' : ''}
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Associated Commits - Collapsible */}
                                        {subActivity.commits.length > 0 && expandedSubActivities.has(index) && (
                                            <div className="mt-2 space-y-1.5">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-xs font-medium text-gray-600">Related Commits</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {subActivity.commits.map((commit, commitIndex) => (
                                                        <div key={commitIndex} className="flex items-center gap-2 p-1.5 bg-blue-50 rounded-md border border-blue-100">
                                                            <span className="text-xs font-mono text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                                                {commit.sha.substring(0, 7)}
                                                            </span>
                                                            <span className="text-xs text-gray-700 flex-1">{commit.message}</span>
                                                            <a 
                                                                href={commit.url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                                                            >
                                                                View
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
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
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Activity Feed</h2>
                        <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                    <div className="h-2 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                                    <div className="h-2 bg-gray-200 rounded w-2/3 animate-pulse"></div>
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
                <div className="p-4">
                    <div className="text-center">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <XCircleIcon className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-base font-medium text-gray-900 mb-2">Failed to load activity feed</h3>
                        <p className="text-gray-500 mb-3">{error}</p>
                        <button
                            onClick={loadActivities}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
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
                <div className="p-4">
                    <div className="text-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ClockIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <h3 className="text-base font-medium text-gray-900 mb-2">No activity yet</h3>
                        <p className="text-gray-500 text-sm">
                            Activity will appear here once you start making changes to your repositories.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Activity Feed</h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={loadActivities}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Refresh"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {activities.map((activity, index) => (
                        <EnhancedActivityEventItem key={index} activity={activity} />
                    ))}
                </div>
            </div>
        </div>
    );
} 