
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useState } from 'react';
import { ActivityFeedService, PaginatedActivityResponse } from '../../services/activityFeed';
import { ActivityEvent } from '../../shared/types';
import { ActivityEventItem } from './ActivityEventItem';
import { ActivityFeedSkeleton } from './ActivityFeedSkeleton';
import { ActivityFeedError } from './ActivityFeedError';
import { ActivityFeedEmpty } from './ActivityFeedEmpty';

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
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400) {
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
        return <ActivityFeedSkeleton className={className} />;
    }

    if (error) {
        return <ActivityFeedError message={error} onRetry={() => loadActivities()} className={className} />;
    }

    if (activities.length === 0) {
        return <ActivityFeedEmpty className={className} />;
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
                        <ActivityEventItem key={`${activity.title}-${index}`} activity={activity} />
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