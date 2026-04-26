import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline"

import type { FilterResultUnit as FilterResultUnitModel } from "../turnModel"

export function FilterResultUnit({ unit }: { unit: FilterResultUnitModel }) {
    const radius = 6
    const circumference = 2 * Math.PI * radius
    const confidenceColor = unit.confidence >= 0.8 ? "text-success" : "text-warning"

    return (
        <div className="select-text">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <div className="rounded-lg border border-border bg-muted p-4">
                        <div className="flex items-start gap-3 mb-3">
                            {unit.isRelevant ? <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0" /> : <XCircleIcon className="w-5 h-5 text-warning flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="text-sm font-semibold text-foreground">{unit.isRelevant ? "Event Approved" : "Event Filtered Out"}</div>
                                    <div className="relative w-4 h-4 flex-shrink-0" title={`Confidence: ${Math.round(unit.confidence * 100)}%`}>
                                        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 16 16">
                                            <circle cx="8" cy="8" r={radius} fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/30" />
                                            <circle
                                                cx="8"
                                                cy="8"
                                                r={radius}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                className={confidenceColor}
                                                strokeDasharray={circumference}
                                                strokeDashoffset={circumference * (1 - unit.confidence)}
                                            />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{unit.reason}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
