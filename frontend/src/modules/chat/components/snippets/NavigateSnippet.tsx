import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

import type { ChatSnippet } from "terse-types"

export type NavigateSnippetData = Extract<ChatSnippet, { type: "navigate" }>

export function NavigateSnippet({ snippet }: { snippet: NavigateSnippetData }) {
    const navigate = useNavigate()

    useEffect(() => {
        navigate(snippet.path)
    }, [snippet.path, navigate])

    return null
}
