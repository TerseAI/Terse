import { useState } from "react"

import { Check, Copy, KeyRound, Pencil, Plus, Trash2 } from "lucide-react"
import { ApiToken } from "terse-types/types"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BackendProvider } from "@/lib/http"
import { useApiTokens } from "@/modules/apiTokens/api/useApiTokens"
import { formatRelativeTime, getFullTimestamp } from "@/utils/time"

export default function ApiTokensPage() {
    const { apiTokens, isError, mutate } = useApiTokens()

    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [editingToken, setEditingToken] = useState<ApiToken | null>(null)
    const [deletingToken, setDeletingToken] = useState<ApiToken | null>(null)
    const [createdRawToken, setCreatedRawToken] = useState<string | null>(null)

    const isLoading = apiTokens === undefined && !isError
    const hasTokens = apiTokens && apiTokens.length > 0

    return (
        <div className="flex h-full flex-col p-4">
            <PageHeader onCreate={() => setShowCreateDialog(true)} showAction={hasTokens ?? false} />

            <div className="mt-4 flex flex-1 flex-col">
                {isError ? (
                    <ErrorState onRetry={() => mutate()} />
                ) : isLoading ? (
                    <LoadingState />
                ) : hasTokens ? (
                    <TokensTable tokens={apiTokens} onRename={setEditingToken} onDelete={setDeletingToken} />
                ) : (
                    <EmptyState onCreate={() => setShowCreateDialog(true)} />
                )}
            </div>

            <CreateTokenDialog
                open={showCreateDialog}
                createdRawToken={createdRawToken}
                onOpenChange={open => {
                    setShowCreateDialog(open)
                    if (!open) setCreatedRawToken(null)
                }}
                onCreated={rawToken => {
                    setCreatedRawToken(rawToken)
                    mutate()
                }}
            />

            <RenameTokenDialog token={editingToken} onOpenChange={() => setEditingToken(null)} onUpdated={() => mutate()} />

            <RevokeTokenDialog token={deletingToken} onOpenChange={() => setDeletingToken(null)} onRevoked={() => mutate()} />
        </div>
    )
}

function PageHeader({ onCreate, showAction }: { onCreate: () => void; showAction: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-bold text-foreground">API Tokens</h1>
                <p className="text-sm text-muted-foreground">Create tokens to authenticate with the Terse SDK from your code, CI, or any automated pipeline.</p>
            </div>
            {showAction && (
                <Button size="sm" onClick={onCreate} className="shrink-0">
                    <Plus className="h-4 w-4" />
                    New token
                </Button>
            )}
        </div>
    )
}

interface TokensTableProps {
    tokens: ApiToken[]
    onRename: (token: ApiToken) => void
    onDelete: (token: ApiToken) => void
}

function TokensTable({ tokens, onRename, onDelete }: TokensTableProps) {
    return (
        <TooltipProvider delayDuration={250}>
            <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
                <Table>
                    <TableHeader className="bg-muted/20">
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Name</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Last used</TableHead>
                            <TableHead className="w-[96px] text-right">
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tokens.map(token => (
                            <TableRow key={token.id}>
                                <TableCell className="font-medium">{token.name}</TableCell>
                                <TableCell>
                                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token.tokenPrefix}…</code>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>{formatRelativeTime(token.createdAt)}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>{getFullTimestamp(token.createdAt)}</TooltipContent>
                                    </Tooltip>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {token.lastUsedAt ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>{formatRelativeTime(token.lastUsedAt)}</span>
                                            </TooltipTrigger>
                                            <TooltipContent>{getFullTimestamp(token.lastUsedAt)}</TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <span className="text-muted-foreground/70">Never</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon-sm" onClick={() => onRename(token)} aria-label={`Rename ${token.name}`}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Rename</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon-sm" className="text-danger hover:text-danger" onClick={() => onDelete(token)} aria-label={`Revoke ${token.name}`}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Revoke</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
    )
}

function LoadingState() {
    return (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <Table>
                <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last used</TableHead>
                        <TableHead className="w-[96px] text-right">
                            <span className="sr-only">Actions</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                                <div className="flex justify-end gap-1">
                                    <Skeleton className="h-7 w-7 rounded-md" />
                                    <Skeleton className="h-7 w-7 rounded-md" />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <Empty className="flex-1 border border-dashed border-border/60 bg-card/40">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <KeyRound className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No API tokens yet</EmptyTitle>
                <EmptyDescription>Create a token to start using the Terse SDK from your code or CI.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button size="sm" onClick={onCreate}>
                    <Plus className="h-4 w-4" />
                    Create your first token
                </Button>
            </EmptyContent>
        </Empty>
    )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm text-danger">Unable to load API tokens right now.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                Retry
            </Button>
        </div>
    )
}

interface CreateTokenDialogProps {
    open: boolean
    createdRawToken: string | null
    onOpenChange: (open: boolean) => void
    onCreated: (rawToken: string) => void
}

function CreateTokenDialog({ open, createdRawToken, onOpenChange, onCreated }: CreateTokenDialogProps) {
    const [name, setName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleCreate = async () => {
        const trimmed = name.trim()
        if (!trimmed) return
        setIsCreating(true)
        setError(null)
        try {
            const result = await BackendProvider.createApiToken(trimmed)
            onCreated(result.rawToken)
            setName("")
        } catch {
            setError("Failed to create token. Please try again.")
        } finally {
            setIsCreating(false)
        }
    }

    const handleCopy = async () => {
        if (!createdRawToken) return
        await navigator.clipboard.writeText(createdRawToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setName("")
            setError(null)
            setCopied(false)
        }
        onOpenChange(nextOpen)
    }

    const isReveal = createdRawToken !== null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isReveal ? "Your new token is ready" : "Create API token"}</DialogTitle>
                    <DialogDescription>{isReveal ? "Copy this token now. For security, we won't show it again." : "Give your token a name to help you remember what it's for."}</DialogDescription>
                </DialogHeader>

                {isReveal ? (
                    <div className="flex flex-col gap-3">
                        <div className="rounded-md border border-border/60 bg-muted/60 px-3 py-3">
                            <code className="block font-mono text-[13px] leading-relaxed text-foreground break-all select-all">{createdRawToken}</code>
                        </div>
                        <Button onClick={handleCopy} variant="outline" className="w-full">
                            {copied ? (
                                <>
                                    <Check className="h-4 w-4 text-success" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4" />
                                    Copy token
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <Input placeholder="e.g. CI/CD pipeline" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus />
                        {error && <p className="text-xs text-danger">{error}</p>}
                    </div>
                )}

                <DialogFooter>
                    {isReveal ? (
                        <DialogClose asChild>
                            <Button>Done</Button>
                        </DialogClose>
                    ) : (
                        <>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
                                {isCreating ? "Creating..." : "Create token"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface RenameTokenDialogProps {
    token: ApiToken | null
    onOpenChange: () => void
    onUpdated: () => void
}

function RenameTokenDialog({ token, onOpenChange, onUpdated }: RenameTokenDialogProps) {
    const [name, setName] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleOpen = (open: boolean) => {
        if (!open) {
            onOpenChange()
            setName("")
            setError(null)
        }
    }

    const handleSave = async () => {
        const trimmed = name.trim()
        if (!token || !trimmed) return
        setIsSaving(true)
        setError(null)
        try {
            await BackendProvider.updateApiToken(token.id, trimmed)
            onUpdated()
            onOpenChange()
            setName("")
        } catch {
            setError("Failed to rename token. Please try again.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={!!token} onOpenChange={handleOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename token</DialogTitle>
                    <DialogDescription>Enter a new name for "{token?.name}".</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                    <Input placeholder="New token name" value={name || token?.name || ""} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} autoFocus />
                    {error && <p className="text-xs text-danger">{error}</p>}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface RevokeTokenDialogProps {
    token: ApiToken | null
    onOpenChange: () => void
    onRevoked: () => void
}

function RevokeTokenDialog({ token, onOpenChange, onRevoked }: RevokeTokenDialogProps) {
    const [isRevoking, setIsRevoking] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleRevoke = async () => {
        if (!token) return
        setIsRevoking(true)
        setError(null)
        try {
            await BackendProvider.deleteApiToken(token.id)
            onRevoked()
            onOpenChange()
        } catch {
            setError("Failed to revoke token. Please try again.")
        } finally {
            setIsRevoking(false)
        }
    }

    const handleOpen = (open: boolean) => {
        if (!open) {
            setError(null)
            onOpenChange()
        }
    }

    return (
        <Dialog open={!!token} onOpenChange={handleOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Revoke token</DialogTitle>
                    <DialogDescription>Revoke "{token?.name}"? Any SDK job or script using this token will stop working immediately. This cannot be undone.</DialogDescription>
                </DialogHeader>
                {error && <p className="text-xs text-danger">{error}</p>}
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={handleRevoke} disabled={isRevoking}>
                        {isRevoking ? "Revoking..." : "Revoke token"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
