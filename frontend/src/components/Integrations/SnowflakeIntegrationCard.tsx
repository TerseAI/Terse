import { useState } from "react"

import { Database } from "lucide-react"
import { INTEGRATION_METADATA, IntegrationType, SnowflakeIntegration } from "terse-types/Integrations"

import { useSnowflakeIntegrations } from "@/hooks/api/useSnowflakeIntegrations"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"

import { Button } from "../ui/button"
import { Card, CardContent, CardFooter } from "../ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Skeleton } from "../ui/skeleton"
import { Textarea } from "../ui/textarea"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function SnowflakeIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = useSnowflakeIntegrations()
    const [showForm, setShowForm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [accountIdentifier, setAccountIdentifier] = useState("")
    const [username, setUsername] = useState("")
    const [privateKey, setPrivateKey] = useState("")
    const [passphrase, setPassphrase] = useState("")
    const [warehouse, setWarehouse] = useState("")

    const handleConnect = () => {
        setShowForm(true)
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await BackendProvider.createOrUpdateSnowflakeIntegration(accountIdentifier, username, privateKey, passphrase, warehouse, stateToken)
            setShowForm(false)
            resetForm()
            mutate()
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect Snowflake integration")
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setAccountIdentifier("")
        setUsername("")
        setPrivateKey("")
        setPassphrase("")
        setWarehouse("")
    }

    const handleCancel = () => {
        setShowForm(false)
        resetForm()
        setError(null)
    }

    const isConnected = integrations.length > 0
    const summary = integrations[0] ? `Account: ${integrations[0].accountIdentifier}` : undefined

    const formDialog = (
        <Dialog open={showForm} onOpenChange={open => !open && handleCancel()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Connect {INTEGRATION_METADATA[IntegrationType.SNOWFLAKE].name}</DialogTitle>
                    <DialogDescription>
                        Enter your Snowflake credentials to connect using key-pair authentication.{" "}
                        <a href="https://docs.snowflake.com/en/user-guide/key-pair-auth" target="_blank" rel="noopener noreferrer" className="underline">
                            Setup instructions
                        </a>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="accountIdentifier">Account Identifier *</Label>
                        <Input
                            id="accountIdentifier"
                            type="text"
                            value={accountIdentifier}
                            onChange={e => setAccountIdentifier(e.target.value)}
                            placeholder="myorg-myaccount"
                            disabled={isSubmitting}
                            required
                            autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">Your Snowflake account identifier (e.g. myorg-myaccount or xy12345.us-east-1)</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="username">Username *</Label>
                        <Input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="TERSE_USER" disabled={isSubmitting} required autoComplete="off" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="privateKey">Private Key (PEM) *</Label>
                        <Textarea
                            id="privateKey"
                            value={privateKey}
                            onChange={e => setPrivateKey(e.target.value)}
                            placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                            disabled={isSubmitting}
                            required
                            rows={5}
                            className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">RSA private key in PEM format for key-pair authentication.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="passphrase">Private Key Passphrase</Label>
                        <Input id="passphrase" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} disabled={isSubmitting} autoComplete="off" />
                        <p className="text-xs text-muted-foreground">Only needed for `ENCRYPTED PRIVATE KEY` PEMs. This is not your Snowflake user password.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="warehouse">Warehouse *</Label>
                        <Input id="warehouse" type="text" value={warehouse} onChange={e => setWarehouse(e.target.value)} placeholder="COMPUTE_WH" disabled={isSubmitting} required autoComplete="off" />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="flex gap-2">
                        <Button type="submit" disabled={isSubmitting || !accountIdentifier || !username || !privateKey || !warehouse}>
                            {isSubmitting ? "Connecting..." : "Connect"}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )

    if (compact) {
        return (
            <>
                <CompactIntegrationRow integration={IntegrationType.SNOWFLAKE} isConnected={isConnected} summary={summary} connect={handleConnect} isConnecting={isSubmitting} className={className} />
                {formDialog}
            </>
        )
    }

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={IntegrationType.SNOWFLAKE} isActive={isActive} />
                <CardContent>
                    <SnowflakeCardContent integrations={integrations} isLoading={isLoading} />
                </CardContent>
                <CardFooter>
                    <Button variant="outline" onClick={handleConnect}>
                        {integrations.length > 0 ? "Update" : "Connect"}
                    </Button>
                </CardFooter>
            </Card>
            {formDialog}
        </>
    )
}

function SnowflakeCardContent({ integrations, isLoading }: { integrations: Array<SnowflakeIntegration>; isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Database className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No Snowflake integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Snowflake account to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Database className="w-4 h-4" />}
                    title={`Snowflake (${integration.accountIdentifier})`}
                    description={`Warehouse: ${integration.warehouse}${integration.databaseName ? ` · DB: ${integration.databaseName}` : ""}`}
                />
            ))}
        </div>
    )
}

export default SnowflakeIntegrationCard
