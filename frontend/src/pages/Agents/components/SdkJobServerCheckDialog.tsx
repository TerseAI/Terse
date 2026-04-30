import { AlertCircle, CheckCircle2 } from "lucide-react"
import type { SdkJobServerCheckResponse } from "terse-types"

import { Button } from "../../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog"

function formatServerCheckStep(step: NonNullable<SdkJobServerCheckResponse["step"]>) {
    switch (step) {
        case "http":
            return "Connecting to the trigger endpoint"
        case "json":
            return "Reading the server response"
        case "response_schema":
            return "Validating the handshake payload"
        case "challenge_echo":
            return "Verifying the challenge response"
        case "challenge_signature":
            return "Verifying the signing secret"
        default:
            return step
    }
}

export function SdkJobServerCheckDialog({ open, result, onClose }: { open: boolean; result: SdkJobServerCheckResponse | null; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{result?.success ? "Server Verified" : "Server Check Failed"}</DialogTitle>
                    <DialogDescription>
                        {result?.success
                            ? "This self-hosted SDK job is ready to receive triggers from Terse."
                            : "Terse could not complete the verification handshake with your self-hosted SDK server."}
                    </DialogDescription>
                </DialogHeader>

                {result && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                                {result.success ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-danger" />}
                            </div>
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium">{result.success ? "Ready to receive jobs" : "Verification did not complete"}</p>
                                <p className="text-sm text-muted-foreground">{result.message}</p>
                            </div>
                        </div>

                        {result.triggerUrl && (
                            <div className="space-y-1.5 rounded-lg border border-input bg-muted/30 p-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Trigger Endpoint</h3>
                                <p className="text-sm break-all">{result.triggerUrl}</p>
                            </div>
                        )}

                        {result.step && (
                            <div className="space-y-1.5 rounded-lg border border-input bg-muted/30 p-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Check Stage</h3>
                                <p className="text-sm">{formatServerCheckStep(result.step)}</p>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
