import { useState } from "react"
import ReactMarkdown from "react-markdown"

import { Textarea } from "@/components/ui/textarea"
import { AgentPrompt } from "@/shared/types"

const instructionsPlaceholder = `Describe what you want the AI to do with incoming events from your sources.

For example:
- "Monitor all new GitHub issues and create Linear tickets for bugs, adding appropriate labels and priority"
- "Watch for Notion database updates and post summaries to Slack with key changes highlighted"
- "Track customer feedback from multiple channels and synthesize weekly reports"

Be specific about:
• What information to extract or focus on
• How to format or structure the output
• Any rules for filtering or prioritizing events
• The tone or style for generated content`

const clickHerePlaceholder = `## Click here to edit instructions`

interface InstructionsEditorProps {
    prompt: AgentPrompt | undefined
    setPrompt: (prompt: AgentPrompt | undefined) => void
    isIncomplete?: boolean
}

type InstructionsEditorContentProps = {
    text: string
    prompt: AgentPrompt | undefined
    setPrompt: (prompt: AgentPrompt | undefined) => void
}

function InstructionsEditorContent({ text, prompt, setPrompt }: InstructionsEditorContentProps) {
    const [showMarkdown, setShowMarkdown] = useState(true)
    return (
        <>
            {showMarkdown ? (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowMarkdown(false)}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") setShowMarkdown(false)
                    }}
                    className="flex-1 min-h-0 flex flex-col"
                >
                    <div className="flex-1 min-h-0 overflow-auto react-markdown rounded-md p-2 border border-foreground/10 bg-background shadow-sm hover:border-foreground/15 transition">
                        <ReactMarkdown>{prompt?.text ?? clickHerePlaceholder}</ReactMarkdown>
                    </div>
                </div>
            ) : (
                <Textarea
                    value={text}
                    onChange={e => setPrompt({ ...prompt, text: e.target.value })}
                    className="flex-1 min-h-0 resize-none overflow-auto"
                    autoFocus
                    onBlur={() => setShowMarkdown(true)}
                    onFocus={() => setShowMarkdown(false)}
                    placeholder={instructionsPlaceholder}
                />
            )}
        </>
    )
}

export function InstructionsEditor({ prompt, setPrompt }: InstructionsEditorProps) {
    const text: string = prompt?.text ?? ""

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <InstructionsEditorContent text={text} prompt={prompt} setPrompt={setPrompt} />
        </div>
    )
}
