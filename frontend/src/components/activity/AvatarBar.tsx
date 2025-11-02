import { ActivityEvent } from "../../shared/types";
import { formatEventTitle, getEventBadgeStyle } from "../../utility/TextFormatters";
import GitHubAvatar from "../ui/GithubAvatar";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

function AvatarBar({ event }: { event: ActivityEvent }) {
    return (
        <div className="flex items-center gap-3">
            <GitHubAvatar username={event.github_repository_owner_id} size={48} />
            <div className="grid auto-cols-max grid-flow-col gap-3">
                <h3 className="font-semibold text-lg text-[theme(text-primary)]">
                    {event.github_repository_name}
                </h3>
                <Badge variant="outline" className={cn(getEventBadgeStyle(event.event_type))}>
                    {formatEventTitle(event)}
                </Badge>
            </div>
        </div>
    )
}

export default AvatarBar;