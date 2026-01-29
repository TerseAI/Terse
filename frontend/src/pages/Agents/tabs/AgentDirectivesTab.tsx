import { useState } from "react";
import { useDirectives, useDirectiveMutations } from "@/hooks/api/useDirectives";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, ScrollText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DirectiveRecord } from "@/shared/types";

type AgentDirectivesTabProps = {
    agentId: string | null;
};

export default function AgentDirectivesTab({ agentId }: AgentDirectivesTabProps) {
    const { directives, isLoading, mutate } = useDirectives(agentId);
    const { deleteDirective } = useDirectiveMutations();
    const [directiveToDelete, setDirectiveToDelete] = useState<DirectiveRecord | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = (directive: DirectiveRecord) => {
        setDirectiveToDelete(directive);
    };

    const handleConfirmDelete = async () => {
        if (!directiveToDelete || !agentId) return;

        setIsDeleting(true);
        try {
            await deleteDirective(agentId, directiveToDelete.id);
            toast.success("Directive deleted successfully");
            setDirectiveToDelete(null);
            mutate();
        } catch {
            toast.error("Failed to delete directive");
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!agentId) {
        return (
            <div className="flex flex-col h-full min-h-0 p-6">
                <Empty className="border">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <AlertCircle />
                        </EmptyMedia>
                        <EmptyTitle>Save Your Agent First</EmptyTitle>
                        <EmptyDescription>
                            You need to save your agent before you can view or manage directives.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col h-full min-h-0 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-32 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-medium">Directives</h2>
                        <p className="text-sm text-muted-foreground">
                            Directives are corrections to past agent behavior. They help the agent learn and improve its responses over time.
                        </p>
                    </div>
                    {directives.length > 0 && (
                        <Badge variant="secondary">
                            {directives.length} {directives.length === 1 ? 'directive' : 'directives'}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
                {directives.length === 0 ? (
                    <Empty className="border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ScrollText />
                            </EmptyMedia>
                            <EmptyTitle>No Directives Yet</EmptyTitle>
                            <EmptyDescription>
                                Directives are created when you provide feedback to correct the agent's behavior during conversations.
                                They help the agent learn your preferences and improve future responses.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60%]">Directive</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {directives.map((directive) => (
                                    <TableRow key={directive.id}>
                                        <TableCell className="font-medium whitespace-normal">
                                            <p className="text-sm leading-relaxed">
                                                {directive.directiveDescription}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={directive.isActive ? "default" : "secondary"}
                                                className={cn(
                                                    directive.isActive
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                        : ""
                                                )}
                                            >
                                                {directive.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDate(directive.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => handleDeleteClick(directive)}
                                                className="hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!directiveToDelete} onOpenChange={(open) => !open && setDirectiveToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Directive</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this directive? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {directiveToDelete && (
                        <div className="rounded-md bg-muted p-3 text-sm">
                            {directiveToDelete.directiveDescription}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDirectiveToDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
