import {
    ArrowPathIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClockIcon,
    CodeBracketIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { ActivityFeedService, PaginatedActivityResponse } from '../services/activityFeed';
import { ActivityEvent } from '../shared/types';
import GitHubAvatar from './GithubPhoto';

// Refined time formatting with elegant typography
const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
};

// Jonny Ive-inspired Activity Event Item
const EnhancedActivityEventItem: React.FC<{ activity: ActivityEvent }> = ({ activity }) => {
    const [expandedSubActivities, setExpandedSubActivities] = useState<Set<number>>(new Set());

    const getEventIcon = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return <CodeBracketIcon className="w-4 h-4 text-slate-600" />;
            case 'PULL_REQUEST_OPENED':
                return <ArrowPathIcon className="w-4 h-4 text-emerald-600" />;
            case 'PULL_REQUEST_MERGED':
                return <CheckCircleIcon className="w-4 h-4 text-violet-600" />;
            case 'PULL_REQUEST_CLOSED':
                return <XCircleIcon className="w-4 h-4 text-rose-600" />;
            case 'PULL_REQUEST_UPDATED':
                return <ArrowPathIcon className="w-4 h-4 text-amber-600" />;
            default:
                return <ClockIcon className="w-4 h-4 text-slate-500" />;
        }
    };

    const getEventColor = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return 'from-blue-50 to-blue-25 border-blue-100';
            case 'PULL_REQUEST_OPENED':
                return 'from-emerald-50 to-emerald-25 border-emerald-100';
            case 'PULL_REQUEST_MERGED':
                return 'from-violet-50 to-violet-25 border-violet-100';
            case 'PULL_REQUEST_CLOSED':
                return 'from-rose-50 to-rose-25 border-rose-100';
            case 'PULL_REQUEST_UPDATED':
                return 'from-amber-50 to-amber-25 border-amber-100';
            default:
                return 'from-slate-50 to-slate-25 border-slate-100';
        }
    };

    const getEventTypeLabel = (eventType: string) => {
        switch (eventType) {
            case 'PUSH':
                return 'Push';
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
        <div 
            className={`
                group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${getEventColor(activity.event_type)}
                transition-all duration-500 ease-out
            `}
        >   
            <div className="relative p-4">
                <div className="flex items-start space-x-3">
                    {/* Avatar with refined styling */}
                    <div className="flex-shrink-0">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/80 shadow-lg">
                                <GitHubAvatar username={activity.github_repository_owner_id} size={40} />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-lg ring-2 ring-white">
                                {getEventIcon(activity.event_type)}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-2">
                        {/* Header with refined typography */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-slate-900 tracking-tight">
                                    {activity.github_repository_name}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/60 text-slate-700 backdrop-blur-sm border border-white/40">
                                    {getEventTypeLabel(activity.event_type)}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-slate-500">
                                <span className="font-mono tracking-wide">
                                    {formatTimeAgo(activity.created_at)}
                                </span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className="font-medium text-slate-600">
                                    {activity.github_repository_owner_id}
                                </span>
                            </div>
                        </div>
                        
                        {/* Title with elegant typography */}
                        <h3 className="text-base font-semibold text-slate-900 leading-tight tracking-tight">
                            {activity.title}
                        </h3>
                        
                        {/* Sub Activities with refined design */}
                        {activity.sub_activities.length > 0 && (
                            <div className="space-y-2 pt-1">
                                {activity.sub_activities.map((subActivity, index) => (
                                    <div key={index} className="bg-white/40 backdrop-blur-sm rounded-lg border border-white/60 overflow-hidden">
                                        <div className="p-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-slate-700 leading-relaxed flex-1">
                                                    {subActivity.summary}
                                                </p>
                                                {subActivity.commits.length > 0 && (
                                                    <button
                                                        onClick={() => toggleSubActivity(index)}
                                                        className="ml-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors duration-200 font-medium"
                                                    >
                                                        {expandedSubActivities.has(index) ? (
                                                            <>
                                                                <ChevronDownIcon className="w-3 h-3 transition-transform duration-200" />
                                                                Hide
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronRightIcon className="w-3 h-3 transition-transform duration-200" />
                                                                {subActivity.commits.length} commit{subActivity.commits.length !== 1 ? 's' : ''}
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {/* Associated Commits with elegant styling */}
                                            {subActivity.commits.length > 0 && expandedSubActivities.has(index) && (
                                                <div className="mt-3 space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-xs font-medium text-slate-600 tracking-wide uppercase">Commits</span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {subActivity.commits.map((commit, commitIndex) => (
                                                            <div key={commitIndex} className="flex items-center gap-2 p-2 bg-slate-50/80 rounded-md border border-slate-100/60 backdrop-blur-sm">
                                                                <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded tracking-wide">
                                                                    {commit.sha.substring(0, 7)}
                                                                </span>
                                                                <span className="text-xs text-slate-700 flex-1 leading-relaxed">{commit.message}</span>
                                                                <a 
                                                                    href={commit.url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-slate-600 hover:text-slate-800 transition-colors duration-200 font-medium"
                                                                >
                                                                    View →
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
        </div>
    );
};

interface ActivityFeedProps {
    className?: string;
}

export function ActivityFeed({ className = "" }: ActivityFeedProps) {
    const [activities, setActivities] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

    const loadActivities = async (cursor?: string) => {
        try {
            if (cursor) {
                setIsLoadingMore(true);
            } else {
                setIsLoading(true);
            }
            setError(null);
            
            const response: PaginatedActivityResponse = await ActivityFeedService.getActivityFeed({
                cursor,
                limit: 25
            });
            
            if (cursor) {
                // Append new activities for pagination
                setActivities(prev => [...prev, ...response.activities]);
            } else {
                // Replace activities for initial load
                setActivities(response.activities);
            }
            
            setHasMore(response.pagination.hasMore);
            setNextCursor(response.pagination.nextCursor);
        } catch (err) {
            setError('Failed to load activity feed');
            console.error('Error loading activity feed:', err);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const loadMore = () => {
        if (!isLoadingMore && hasMore && nextCursor) {
            loadActivities(nextCursor);
        }
    };

    // Simple scroll handler for infinite scroll
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100) {
                loadMore();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isLoadingMore, hasMore, nextCursor]);

    // Initial load
    useEffect(() => {
        loadActivities();
    }, []);

    if (isLoading) {
        return (
            <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-light text-slate-900 tracking-tight">Activity</h2>
                        <div className="w-5 h-5 bg-slate-200 rounded-full animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-start space-x-3 p-4 border border-slate-200/60 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-25">
                                <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-slate-200 rounded-lg w-3/4 animate-pulse"></div>
                                    <div className="h-2 bg-slate-200 rounded-lg w-1/2 animate-pulse"></div>
                                    <div className="h-2 bg-slate-200 rounded-lg w-2/3 animate-pulse"></div>
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
            <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
                <div className="p-6">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircleIcon className="w-6 h-6 text-rose-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight">Unable to load activity</h3>
                        <p className="text-slate-500 mb-4 leading-relaxed text-sm">{error}</p>
                        <button
                            onClick={() => loadActivities()}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 text-sm font-medium tracking-wide"
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
            <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
                <div className="p-6">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClockIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2 tracking-tight">No activity yet</h3>
                        <p className="text-slate-500 leading-relaxed max-w-md mx-auto text-sm">
                            Activity will appear here once you start making changes to your repositories.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-xl ${className}`}>
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-light text-slate-900 tracking-tight">Activity</h2>
                    <button
                        onClick={() => loadActivities()}
                        className="p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200 rounded-full hover:bg-slate-100/50"
                        title="Refresh"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    {activities.map((activity, index) => (
                        <EnhancedActivityEventItem key={`${activity.title}-${index}`} activity={activity} />
                    ))}
                    
                    {/* Loading indicator for pagination */}
                    {isLoadingMore && (
                        <div className="flex justify-center py-4">
                            <div className="flex items-center space-x-2 text-slate-500">
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                                <span className="text-sm">Loading more...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 