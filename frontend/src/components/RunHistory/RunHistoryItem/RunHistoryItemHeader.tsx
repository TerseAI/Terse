import type { RunHistoryRecord } from "../../../shared/RunHistoryTypes";
import RunHistoryItemTriggerHeader from "./RunHistoryItemTriggerHeader";

type Props = {
    run: RunHistoryRecord;
    formattedTimestamp: string;
    onCopy: (text: string) => void;
};

export default function RunHistoryItemHeader({ run, formattedTimestamp, onCopy }: Props) {
    return (
        <RunHistoryItemTriggerHeader trigger={run.trigger} formattedTimestamp={formattedTimestamp} onCopy={onCopy} />
    );
}


