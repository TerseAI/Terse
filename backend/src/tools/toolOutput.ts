import type { ToolOutputByName } from "../shared/types"

export function toolOutput<TName extends keyof ToolOutputByName>(toolName: TName, output: ToolOutputByName[TName]): ToolOutputByName[TName] {
    void toolName
    return output
}
