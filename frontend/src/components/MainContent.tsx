import { ActivityFeed } from "./ActivityFeed";

interface MainContentProps {
    className?: string;
}

export function MainContent({ className = "" }: MainContentProps) {
    return (
        <div className={`lg:col-span-3 ${className}`}>
            <ActivityFeed />
            {/* <ChatInterface /> */}
        </div>
    );
} 