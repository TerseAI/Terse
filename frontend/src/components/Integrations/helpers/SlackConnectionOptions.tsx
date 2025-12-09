import { Button } from "../../ui/button";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Label } from "../../ui/label";
import { ArrowLeft } from "lucide-react";

interface SlackConnectionOptionsProps {
    isBotUser: boolean;
    setIsBotUser: (value: boolean) => void;
    onBack: () => void;
    onConnect: () => void;
    isConnecting: boolean;
}

export function SlackConnectionOptions({
    isBotUser,
    setIsBotUser,
    onBack,
    onConnect,
    isConnecting
}: SlackConnectionOptionsProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="h-auto p-1 -ml-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="font-medium text-base">
                        Connect Slack as:
                    </h3>
                </div>
                <RadioGroup
                    className="flex flex-col gap-3 p-1"
                    value={isBotUser ? "botUser" : "user"}
                    onValueChange={(value) => setIsBotUser(value === "botUser")}
                >
                    <div className="flex items-start space-x-2">
                        <RadioGroupItem value="botUser" id="botUser" className="mt-0.5" />
                        <Label htmlFor="botUser" className="text-sm">
                            <span>A Bot User - </span>
                            <span className="italic">Access is limited to channels you invite the bot to.</span>
                        </Label>
                    </div>
                    <div className="flex items-start space-x-2">
                        <RadioGroupItem value="user" id="user" className="mt-0.5" />
                        <Label htmlFor="user" className="text-sm">
                            <span>A User - </span>
                            <span className="italic">The automation acts as you</span>
                        </Label>
                    </div>
                </RadioGroup>
            </div>
            <Button
                className="max-w-xs"
                onClick={onConnect}
                disabled={isConnecting}
            >
                {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
        </div>
    );
}

