import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Step1DescriptionProps } from "./types";
import { LoadingAnimation } from "./LoadingAnimation";

export function Step1Description({
    description,
    setDescription,
    isLoading,
    onContinue
}: Step1DescriptionProps) {
    if (isLoading) {
        return <LoadingAnimation />;
    }

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-sm font-medium mb-2 block">
                    Describe at a high level what you are looking for
                </Label>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Monitor all new GitHub issues and create Linear tickets for bugs, adding appropriate labels and priority"
                    className="w-full min-h-[100px] resize-none"
                />
                <div className="flex justify-end mt-4">
                    <Button
                        onClick={onContinue}
                        disabled={!description.trim() || isLoading}
                    >
                        Continue
                    </Button>
                </div>
            </div>
        </div>
    );
}

