import { useParams } from "react-router-dom"

import SdkJobDetail from "./SdkJobDetail"

function AgentDetail() {
    const { id } = useParams<{ id: string }>()
    if (!id) {
        return (
            <div className="flex h-full items-center justify-center" aria-busy="true">
                <div className="text-muted-foreground text-sm" role="status">
                    Loading...
                </div>
            </div>
        )
    }
    return <SdkJobDetail agentId={id} />
}

export default AgentDetail
