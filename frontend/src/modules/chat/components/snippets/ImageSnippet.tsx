import { useState } from "react"

import { ImageOff } from "lucide-react"
import type { ChatSnippet } from "terse-types"

export type ImageSnippetData = Extract<ChatSnippet, { type: "image" }>

export function ImageSnippet({ snippet }: { snippet: ImageSnippetData }) {
    const [errored, setErrored] = useState(false)

    if (errored) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-1 py-1 text-sm text-muted-foreground">
                <ImageOff className="h-4 w-4 flex-shrink-0" />
                <span>Image unavailable</span>
                <a href={snippet.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs underline hover:text-foreground">
                    Open URL
                </a>
            </div>
        )
    }

    return <img src={snippet.url} alt="Generated image" className="max-w-sm rounded-md border border-border" onError={() => setErrored(true)} />
}
