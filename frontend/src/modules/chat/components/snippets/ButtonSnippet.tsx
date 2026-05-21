import { Link } from "react-router-dom"

import { ExternalLink, SquareArrowOutUpRight } from "lucide-react"
import type { ChatSnippet } from "terse-types"

import { Button } from "@/components/ui/button"

export type ButtonSnippetData = Extract<ChatSnippet, { type: "button" }>

export function ButtonSnippet({ snippet }: { snippet: ButtonSnippetData }) {
    const isInternalPath = snippet.url.startsWith("/")

    return (
        <div>
            {isInternalPath ? (
                <Button asChild variant="outline" size="sm" className="justify-start gap-2 bg-transparent shadow-none hover:bg-transparent">
                    <Link to={snippet.url}>
                        <SquareArrowOutUpRight className="w-4 h-4" />
                        <span>{snippet.label}</span>
                    </Link>
                </Button>
            ) : (
                <Button asChild variant="outline" size="sm" className="justify-start gap-2 bg-transparent shadow-none hover:bg-transparent">
                    <a href={snippet.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        <span>{snippet.label}</span>
                    </a>
                </Button>
            )}
        </div>
    )
}
