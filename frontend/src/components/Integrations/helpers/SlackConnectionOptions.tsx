import { ArrowLeft } from "lucide-react"

import { Button } from "../../ui/button"
import { Label } from "../../ui/label"
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group"

interface SlackConnectionOptionsProps {
    isBotUser: boolean
    setIsBotUser: (value: boolean) => void
    onBack: () => void
    onConnect: () => void
    isConnecting: boolean
}

export function SlackConnectionOptions({ isBotUser, setIsBotUser, onBack, onConnect, isConnecting }: SlackConnectionOptionsProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onBack} className="size-7 shrink-0">
                    <ArrowLeft className="size-4" />
                </Button>
                <p className="text-sm font-medium">Connect Slack as:</p>
            </div>

            <RadioGroup className="space-y-3 pl-9" value={isBotUser ? "botUser" : "user"} onValueChange={value => setIsBotUser(value === "botUser")}>
                <div className="flex items-start gap-2.5">
                    <RadioGroupItem value="botUser" id="botUser" className="mt-0.5" />
                    <Label htmlFor="botUser" className="text-sm font-normal leading-snug">
                        <span className="font-medium">Bot User</span>
                        <span className="text-muted-foreground">
                            {" "}
                            &mdash; requires <code className="rounded bg-muted px-1 py-0.5 text-xs">/invite @Terse</code> in each channel
                        </span>
                    </Label>
                </div>
                <div className="flex items-start gap-2.5">
                    <RadioGroupItem value="user" id="user" className="mt-0.5" />
                    <Label htmlFor="user" className="text-sm font-normal leading-snug">
                        <span className="font-medium">Your Account</span>
                        <span className="text-muted-foreground"> &mdash; the automation acts as you</span>
                    </Label>
                </div>
            </RadioGroup>

            <div className="flex justify-end">
                <Button size="sm" onClick={onConnect} disabled={isConnecting}>
                    {isConnecting ? "Connecting..." : "Connect"}
                </Button>
            </div>
        </div>
    )
}
