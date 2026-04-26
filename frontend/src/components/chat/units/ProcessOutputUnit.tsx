import ProcessOutputItem, { type ProcessOutputEvent } from "../ProcessOutputItem"
import type { ProcessOutputUnit as ProcessOutputUnitModel } from "../turnModel"

export function ProcessOutputUnit({ unit }: { unit: ProcessOutputUnitModel }) {
    const events: ProcessOutputEvent[] = unit.chunks.map((chunk, index) => ({
        id: `${unit.unitId}-${index}`,
        stream: chunk.stream,
        content: chunk.content,
        label: unit.label,
        timestamp: chunk.timestamp
    }))

    return <ProcessOutputItem events={events} />
}
