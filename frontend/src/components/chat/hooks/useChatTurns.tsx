import { useMemo, useState } from "react"

import type { ModelEvent } from "terse-types"

import { type Turn, applyEvent, filterOutThinkingOnlyTurns, makeLocalUserMessageEvent } from "../turnModel"

interface UseChatTurnsOptions {
    initialTurns?: Turn[] | undefined
}

export function useChatTurns({ initialTurns }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>(initialTurns || [])

    const onEvent = (event: ModelEvent) => {
        setTurns(prev => applyEvent(prev, event))
    }

    const addUserTurn = (message: string, clientTurnId: string) => {
        setTurns(prev => applyEvent(prev, makeLocalUserMessageEvent(message, clientTurnId)))
    }
    const handleMultipleChoiceAnswered = (questionId: string, value: string) => {
        setTurns(prev =>
            prev.map(turn => ({
                ...turn,
                units: turn.units.map(unit => {
                    if (unit.kind !== "snippet" || unit.snippet.type !== "multiple_choice" || unit.snippet.questionId !== questionId) return unit
                    return {
                        ...unit,
                        snippet: {
                            ...unit.snippet,
                            selectedValue: value
                        }
                    }
                })
            }))
        )
    }

    const clearTurns = () => {
        setTurns([])
    }

    const filteredTurns = useMemo(() => filterOutThinkingOnlyTurns(turns), [turns])
    const lastTurn = filteredTurns[filteredTurns.length - 1]
    const isPendingAssistantResponse = lastTurn?.status === "generating" || lastTurn?.role === "user" || false

    console.log("useChatTurns filteredTurns", filteredTurns)
    return {
        turns: filteredTurns,
        isPendingAssistantResponse,
        onEvent,
        addUserTurn,
        handleMultipleChoiceAnswered,
        clearTurns
    }
}
