import React, { useState, useEffect } from 'react';
import { ActivityFeedService, DailyActivitySummary } from '../../services/activityFeed';

export const DailySummary: React.FC = () => {
    const [summary, setSummary] = useState<DailyActivitySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDailySummary = async () => {
            try {
                setLoading(true);
                const data = await ActivityFeedService.getDailyActivitySummary();
                setSummary(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching daily summary:', err);
                setError('Failed to load daily summary');
            } finally {
                setLoading(false);
            }
        };

        fetchDailySummary();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="text-red-600 text-sm">
                    {error}
                </div>
            </div>
        );
    }

    if (!summary) {
        return null;
    }

    // Reuse markdown processing logic from TokenStream
    const processMarkdown = (text: string) => {
        let processed = text;
        // Handle code blocks ```
        processed = processed.replace(/```([\s\S]*?)```/g, 
            '<pre class="bg-gray-800 rounded p-4 overflow-x-auto my-4 font-mono"><code>$1</code></pre>'
        );
        // Handle bold **text**
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
        // Handle italic *text* (but not **text**)
        processed = processed.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>');
        // Handle inline code `text`
        processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded font-mono text-sm">$1</code>');
        // Handle headers
        processed = processed.replace(/^#### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
        processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
        processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3 mt-6">$1</h2>');
        processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4 mt-8">$1</h1>');
        // Handle bullet lists - simple approach
        processed = processed.replace(/^\* (.*)$/gm, '• $1');
        processed = processed.replace(/^- (.*)$/gm, '• $1');
        processed = processed.replace(/^\+ (.*)$/gm, '• $1');
        // Handle numbered lists - simple approach
        processed = processed.replace(/^(\d+)\. (.*)$/gm, '$1. $2');
        return <span dangerouslySetInnerHTML={{ __html: processed }} />;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                    Daily Summary
                </h2>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                        {new Date(summary.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {summary.eventCount} events
                    </span>
                </div>
            </div>
            <div className="prose prose-sm max-w-none">
                <div className="text-gray-700 leading-relaxed">
                    {processMarkdown(summary.summary)}
                </div>
            </div>
        </div>
    );
}; 