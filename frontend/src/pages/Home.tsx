import { useEffect, useState } from "react";
import Card from "../components/Card";
import { ActivityFeedService, DailyActivitySummary } from '../services/activityFeed';
import Spin from "../components/loading/Spin";

function Home() {
    return (
        <div className="grid grid-cols-20 gap-4 p-4">
            <div className="col-span-2">
                <h1 className="text-2xl font-bold">Home</h1>
            </div>
            <div className="col-span-18">
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


    if (loading) {
        return <Spin />;
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <Card>
            <h1 className="text-2xl font-bold">Overall Summary</h1>
            <p>{summary?.summary}</p>
        </Card>
    )
}

export default Home;