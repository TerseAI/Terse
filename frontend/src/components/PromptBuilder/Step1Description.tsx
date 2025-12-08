import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Step1DescriptionProps } from "./types";

export function Step1Description({
    description,
    setDescription,
    isLoading,
    onContinue
}: Step1DescriptionProps) {
    return (
        <div className="space-y-4">
            <div>
                <Label className="text-sm font-medium mb-2 block">
                    Describe at a high level what you are looking for
                </Label>
                <div className="flex gap-2">
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Monitor all new GitHub issues and create Linear tickets for bugs, adding appropriate labels and priority"
                        className="flex-1 min-h-[100px]"
                    />
                    <Button
                        onClick={onContinue}
                        disabled={!description.trim() || isLoading}
                        className="self-start"
                    >
                        {isLoading ? (
                            <>
                                <Spinner className="mr-2" />
                                Generating...
                            </>
                        ) : (
                            'Continue'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

