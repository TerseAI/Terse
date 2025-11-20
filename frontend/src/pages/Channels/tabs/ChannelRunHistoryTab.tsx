import RunHistory from "../../../components/RunHistory/index";

type ChannelRunHistoryTabProps = {
    channelId: string | null;
};

export default function ChannelRunHistoryTab({ channelId }: ChannelRunHistoryTabProps) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto w-full">
                <RunHistory channelId={channelId} />
            </div>
        </div>
    );
}