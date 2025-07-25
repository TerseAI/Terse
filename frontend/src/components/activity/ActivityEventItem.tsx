import React, { useState } from 'react';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClockIcon,
    CodeBracketIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { ActivityEvent } from '../../shared/types';
import GitHubAvatar from '../ui/GithubPhoto';

const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
};

export function ActivityEventItem({ activity }: { activity: ActivityEvent }) {
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
}
