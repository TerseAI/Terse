import { ActivityFeed } from "./ActivityFeed";
import { DailySummary } from "./DailySummary";

interface MainContentProps {
    className?: string;
}

export function MainContent({ className = "" }: MainContentProps) {
    return (
        <div className={`lg:col-span-3 ${className}`}>
            <DailySummary />
            <ActivityFeed />
            {/* <ChatInterface /> */}
        </div>
    );
} 