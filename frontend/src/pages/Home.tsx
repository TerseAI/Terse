import { useEffect, useState } from "react";
import Card from "../components/Card";
import DailySummary from "../components/DailySummary";
import { ActivityFeedService, DailyActivitySummary } from '../services/activityFeed';
import { useAuth } from "../services/auth";
import Sidebar from "../components/Sidebar";
import { ActivityEvent } from "../shared/types";
import AvatarBar from "../components/activity/AvatarBar";
import EventDetails from "../components/activity/EventDetails";

function Home() {
    return (
        <div className="h-full flex gap-4">
            <div className="h-full bg-[theme(background-elevated)] rounded-md flex-shrink-0">
                <Sidebar />
            </div>
            <div className="flex-1 min-w-0 pl-4 overflow-y-auto pr-30">
                <Welcome />
                <OverallSummary />
                <ActivityFeed />
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

function ActivityFeed() {
    const [activity, setActivity] = useState<ActivityEvent[]>([]);

    useEffect(() => {
        const fetchActivity = async () => {
            const data = await ActivityFeedService.getActivityFeed();
            setActivity(data.activities);
        }

        fetchActivity();
    }, []);

    return (
        <div className="pt-4 pb-4">
            <h1 className="text-xl font-bold pb-2">Activity Feed</h1>
            <div className="flex flex-col gap-4">
                {activity.map((event, index) => (
                    <Card key={index}>
                        <div className="space-y-4">
                            {/* Header with avatar, repo info, and date */}
                            <div className="flex justify-between">
                                <AvatarBar event={event} />
                                <EventDetails event={event} />
                            </div>

                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                    {event.title}
                                </h4>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}

export default Home;