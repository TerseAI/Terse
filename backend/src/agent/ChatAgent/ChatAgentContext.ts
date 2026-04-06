import { User } from "terse-types"

import type ChatInterface from "./ChatInterfaces/ChatInterface"

export type ChatAgentContext = {
    chatInterface: ChatInterface
    user: User
    sessionId: string
}
