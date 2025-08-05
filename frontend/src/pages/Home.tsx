import { useEffect, useState } from "react";
import Card from "../components/Card";
import DailySummary from "../components/DailySummary";
import { ActivityFeedService, DailyActivitySummary } from '../services/activityFeed';
import { useAuth } from "../services/auth";

function Home() {
    return (
        <div className="h-full flex gap-4">
            <div className="flex-1 min-w-0 overflow-y-auto pr-30">
                <Welcome />
                <OverallSummary />
            </div>
        </div>
    )
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
            <h1 className="text-2xl font-bold pb-4">Overall Summary</h1>
            <Card>
                <DailySummary summary={summary} loading={loading} error={error} />
            </Card>
        </>
    )
}

function Welcome() {
    const { user } = useAuth();
    return (
        <div className="pt-4 pb-4">
            <h1 className="text-xl font-bold pb-2">👋 Hi {user?.display_name}!</h1>
            <p className="text-md">
                here's what your team has been up to
            </p>
        </div>
    )
}
export default Home;