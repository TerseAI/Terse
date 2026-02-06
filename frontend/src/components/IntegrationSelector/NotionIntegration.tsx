import { useEffect } from "react"

import { AlertTriangleIcon, Plus } from "lucide-react"

import { useNotionIntegrations } from "@/hooks/api/useNotionIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { IntegrationType, NotionIntegration as NotionIntegrationType } from "@/shared/Integrations"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import { ConfigType, NotionConfig } from "../../shared/Configs"
import { NotionResourceSelector } from "../NotionResourceSelector"
import DropdownSelect from "../ui/DropdownSelect"
import { Button } from "../ui/button"

import { InputConfigSelectorProps } from "./types"

export function NotionIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useNotionIntegrations()
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.NOTION>(IntegrationType.NOTION, {})
    const currentConfig = input.config as NotionConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, [ConfigType.NOTION])

    useEffect(() => {
        if (integrations.length > 0 && !selectedIntegrationId) {
            setSelectedIntegrationId(integrations[0].id)
        }
    }, [integrations, selectedIntegrationId, setSelectedIntegrationId])

    const updateConfig = (updates: Partial<Pick<NotionConfig, "databaseId" | "databaseName" | "pageId" | "pageName">>) => {
        const id = selectedIntegrationId || currentConfig?.integrationId || ""
        setConfig(
            new NotionConfig(
                id,
                updates.databaseId ?? currentConfig?.databaseId,
                updates.databaseName ?? currentConfig?.databaseName,
                updates.pageId ?? currentConfig?.pageId,
                updates.pageName ?? currentConfig?.pageName
            )
        )
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        )
    }

    if (integrations.length === 0) {
        if (variant === "card") {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Notion
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Notion accounts connected</div>
                <Button onClick={connectOAuth} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : `Connect Notion`}
                </Button>
            </div>
        )
    }

    const connectionSelections = integrations.map((integration: NotionIntegrationType) => ({
        label: integration.workspaceName || "Unknown Workspace",
        value: integration.id
    }))
    const selectedIntegration = connectionSelections.find(c => c.value === selectedIntegrationId) ?? null

    const hasDatabase = !!(currentConfig?.databaseId)
    const hasPage = !!(currentConfig?.pageId)
    const isComplete = currentConfig?.isComplete()

    if (variant === "card") {
        if (!isComplete) {
            if (!hasDatabase && !hasPage) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select database and/or page
                    </div>
                )
            }
            if (!selectedIntegrationId) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select workspace
                    </div>
                )
            }
        }
        return (
            <div className="text-sm">
                {selectedIntegration ? selectedIntegration.label : "No connection selected"}
                {(hasDatabase || hasPage) && (
                    <span className="text-muted-foreground ml-1">
                        ({[hasDatabase && "database", hasPage && "page"].filter(Boolean).join(", ")})
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.NOTION} />
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedIntegration}
                        setSelected={setSelectedIntegrationId}
                        additionalAction={{
                            label: "Connect Another Notion",
                            onClick: connectOAuth
                        }}
                    />
                </div>
            </div>

            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden space-y-4">
                    <p className="text-sm text-muted-foreground">Select at least one: database and/or page</p>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Database (optional)</p>
                        <NotionResourceSelector
                            integrationId={selectedIntegrationId}
                            resourceType="database"
                            selectedResourceId={currentConfig?.databaseId}
                            selectedResourceName={currentConfig?.databaseName}
                            onSelect={(resourceId: string, resourceName: string) => {
                                updateConfig({ databaseId: resourceId, databaseName: resourceName })
                            }}
                        />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Page (optional)</p>
                        <NotionResourceSelector
                            integrationId={selectedIntegrationId}
                            resourceType="page"
                            selectedResourceId={currentConfig?.pageId}
                            selectedResourceName={currentConfig?.pageName}
                            onSelect={(resourceId: string, resourceName: string) => {
                                updateConfig({ pageId: resourceId, pageName: resourceName })
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
