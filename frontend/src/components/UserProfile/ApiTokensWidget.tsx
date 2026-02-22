import { useState } from "react"

import { Check, Copy, Key, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useApiTokens } from "@/hooks/api/useApiTokens"
import { BackendProvider } from "@/services/backend"
import { ApiToken } from "@/shared/types"

import { Button } from "../ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"

export function ApiTokensWidget() {
    const { apiTokens, isError, mutate } = useApiTokens()
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [editingToken, setEditingToken] = useState<ApiToken | null>(null)
    const [deletingToken, setDeletingToken] = useState<ApiToken | null>(null)
    const [createdRawToken, setCreatedRawToken] = useState<string | null>(null)

    if (isError) {
        return <p className="text-destructive text-sm">Failed to load API tokens.</p>
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-foreground">API Tokens</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Create tokens to access the Terse API programmatically.</p>
                </div>
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Token
                </Button>
            </div>

            {!apiTokens ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
            ) : apiTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Key className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No API tokens yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create a token to start using the Terse API.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Last Used</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {apiTokens.map(token => (
                            <TableRow key={token.id}>
                                <TableCell className="font-medium">{token.name}</TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{token.tokenPrefix}...</code>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">{new Date(token.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : "Never"}</TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingToken(token)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingToken(token)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <CreateTokenDialog
                open={showCreateDialog}
                onOpenChange={open => {
                    setShowCreateDialog(open)
                    if (!open) setCreatedRawToken(null)
                }}
                createdRawToken={createdRawToken}
                onCreated={(rawToken: string) => {
                    setCreatedRawToken(rawToken)
                    mutate()
                }}
            />

            <EditTokenDialog token={editingToken} onOpenChange={() => setEditingToken(null)} onUpdated={() => mutate()} />

            <DeleteTokenDialog token={deletingToken} onOpenChange={() => setDeletingToken(null)} onDeleted={() => mutate()} />
        </div>
    )
}

function CreateTokenDialog({
    open,
    onOpenChange,
    createdRawToken,
    onCreated
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    createdRawToken: string | null
    onCreated: (rawToken: string) => void
}) {
    const [name, setName] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [copied, setCopied] = useState(false)

    const handleCreate = async () => {
        if (!name.trim()) return
        setIsCreating(true)
        try {
            const result = await BackendProvider.createApiToken(name.trim())
            onCreated(result.rawToken)
            setName("")
            toast.success("API token created")
        } catch {
            toast.error("Failed to create API token")
        } finally {
            setIsCreating(false)
        }
    }

    const handleCopy = async () => {
        if (!createdRawToken) return
        await navigator.clipboard.writeText(createdRawToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setName("")
            setCopied(false)
        }
        onOpenChange(nextOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{createdRawToken ? "Token Created" : "Create API Token"}</DialogTitle>
                    <DialogDescription>{createdRawToken ? "Copy your token now. You won't be able to see it again." : "Give your token a name to help you remember what it's for."}</DialogDescription>
                </DialogHeader>

                {createdRawToken ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-muted p-2.5 rounded break-all select-all">{createdRawToken}</code>
                            <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Input placeholder="e.g. CI/CD Pipeline" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus />
                )}

                <DialogFooter>
                    {createdRawToken ? (
                        <DialogClose asChild>
                            <Button>Done</Button>
                        </DialogClose>
                    ) : (
                        <>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
                                {isCreating ? "Creating..." : "Create"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function EditTokenDialog({ token, onOpenChange, onUpdated }: { token: ApiToken | null; onOpenChange: () => void; onUpdated: () => void }) {
    const [name, setName] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const handleOpen = (open: boolean) => {
        if (!open) {
            onOpenChange()
            setName("")
        }
    }

    const handleSave = async () => {
        if (!token || !name.trim()) return
        setIsSaving(true)
        try {
            await BackendProvider.updateApiToken(token.id, name.trim())
            onUpdated()
            onOpenChange()
            setName("")
            toast.success("Token renamed")
        } catch {
            toast.error("Failed to rename token")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={!!token} onOpenChange={handleOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename Token</DialogTitle>
                    <DialogDescription>Enter a new name for "{token?.name}".</DialogDescription>
                </DialogHeader>
                <Input placeholder="New token name" value={name || token?.name || ""} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} autoFocus />
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

function DeleteTokenDialog({ token, onOpenChange, onDeleted }: { token: ApiToken | null; onOpenChange: () => void; onDeleted: () => void }) {
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!token) return
        setIsDeleting(true)
        try {
            await BackendProvider.deleteApiToken(token.id)
            onDeleted()
            onOpenChange()
            toast.success("Token deleted")
        } catch {
            toast.error("Failed to delete token")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={!!token} onOpenChange={open => !open && onOpenChange()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Token</DialogTitle>
                    <DialogDescription>Are you sure you want to delete "{token?.name}"? Any applications using this token will lose access.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
