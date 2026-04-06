import { ConfigData } from "terse-types"
import { TransientAgentTrigger } from "terse-types/types"

export interface InputConfigSelectorProps {
    input: TransientAgentTrigger
    variant: "card" | "dialog"
    setConfig: (config: ConfigData) => void
}
