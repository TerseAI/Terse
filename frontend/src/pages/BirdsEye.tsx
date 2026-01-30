import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import DailySummary from "../components/DailySummary";
import { ActivityFeedService, DailyActivitySummary } from '../services/activityFeed';
import { useAuth } from "../services/auth";
import ActivityFeed from "./ActivityFeed";
import { useFeatureFlag } from "../hooks/useFeatureFlag";

function BirdsEyeViewHomepage() {
    // Check if user has the custom homepage feature flag enabled
    const hasCustomHomepage = useFeatureFlag('Birds-eye-view-homepage');

    // If feature flag is enabled, show the custom homepage
    if (hasCustomHomepage) {
        return (
            <div className="grid grid-flow-row gap-4 overflow-y-auto max-w-7xl mx-auto pl-8">
                <div className="grid grid-flow-row pr-30">
                    <Welcome />
                    <OverallSummary />
                </div>
                <div className="grid grid-flow-col min-w-0 overflow-y-auto pr-30">
                    <ActivityFeed />
                </div>
            </div>
        );
    }

    // Default homepage for users without the feature flag
    return (
        <div className="max-w-7xl mx-auto pl-8 pt-8">
            <h1 className="text-2xl pb-4">Welcome</h1>
            <p className="text-md">This is the default homepage.</p>
        </div>
    );
}

function OverallSummary() {
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

    return (
        <>
            <h1 className="text-2xl pb-4">Overall Summary</h1>
            <Card>
                <CardContent>
                    <DailySummary summary={summary} loading={loading} error={error} />
                </CardContent>
            </Card>
        </>
    )
}

function Welcome() {
    const { user } = useAuth();
    return (
        <div className="pt-4 pb-4">
            <h1 className="text-xl pb-2">👋 Hi {user?.display_name}!</h1>
            <p className="text-md">
                here's what your team has been up to
            </p>
        </div>
    )
}

export default BirdsEyeViewHomepage;