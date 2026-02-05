import { Navigate } from "react-router-dom"

import { FrontendRoutes } from "@/shared/FrontendRoutes"

// Agent tables have been removed. The sidebar now shows the list of agents.
// This page redirects to the agent setup page.
export default function AgentsList() {
    return <Navigate to={FrontendRoutes.AGENTS.SETUP} replace />
}
