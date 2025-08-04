import { useEffect, useState } from "react";
import AvatarBar from "../components/activity/AvatarBar";
import Card from "../components/Card";
import { ActivityEvent } from "../shared/types";
import { ActivityFeedService } from "../services/activityFeed";
import EventDetails from "../components/activity/EventDetails";

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
            <div className="flex flex-col gap-4 animate-fade-in">
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


export default ActivityFeed;