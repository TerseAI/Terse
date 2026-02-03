import { createContext, useContext, useEffect, useRef } from "react"

import { DonatedState } from "../shared/DonatedState"

interface ModelContextType {
    donate: (key: string, state: DonatedState) => void
    getStateJSON: () => string
}

const ModelContext = createContext<ModelContextType | null>(null)

export function ModelContextProvider({ children }: { children: React.ReactNode }) {
    const stateRef = useRef<Map<string, DonatedState>>(new Map())

    const contextValue: ModelContextType = {
        donate(key: string, state: DonatedState) {
            stateRef.current.set(key, state)
        },
        getStateJSON() {
            const result: Record<string, unknown> = {}
            stateRef.current.forEach((state, key) => {
                result[key] = state.toJSON()
            })
            return JSON.stringify(result, null, 2)
        }
    }

    return <ModelContext.Provider value={contextValue}>{children}</ModelContext.Provider>
}

export function useModelContext(): ModelContextType {
    const context = useContext(ModelContext)
    if (!context) {
        throw new Error("useModelContext must be used within a ModelContextProvider")
    }
    return context
}

export function useDonateState(key: string, state: DonatedState): void {
    const { donate } = useModelContext()

    useEffect(() => {
        donate(key, state)
    }, [key, state, donate])
}
