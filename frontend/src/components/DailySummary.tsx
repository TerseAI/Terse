import { DailyActivitySummary } from "../services/activityFeed";

function DailySummary({ summary, loading, error }: { summary: DailyActivitySummary | null, loading: boolean, error: string | null }) {
    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-8 bg-[theme(text-disabled)] rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-[theme(text-disabled)] rounded w-full mb-1"></div>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }
    return (
        <>
            <p>{summary?.summary}</p>
        </>
    )
}

export default DailySummary;