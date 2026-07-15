import type { ToolDefinition, ToolName } from "terse-types"
import { IntegrationType, ToolDefinitions, TriggerDefinitions, runHistoryActionBaseSchema, toolsWithIntegrationId } from "terse-types"

import { buildTriggerDeclarationsForBucket } from "../triggerTypeDeclarations.js"
import { type HoistedShape, printType } from "../typePrinter.js"

import { escapeString, toCamelCase, toPascalCase, toolNameToTypeName } from "./moduleHelpers.js"
import { ModuleTemplateRenderer } from "./templateRenderer.js"

const INTEGRATIONS_WITH_TRIGGERS: ReadonlySet<IntegrationType> = new Set(Object.values(TriggerDefinitions).map(definition => definition.integration))

export const RUN_HISTORY_ACTION_HOIST: HoistedShape = { name: "RunHistoryAction", schema: runHistoryActionBaseSchema }

/**
 * One module per integration (plus the built-in "terse" module): owns fetching the
 * integration's workspace data, preparing its template data, and rendering its leaf
 * file bodies. The assembler composes the bodies into the terse.generated bundle.
 */
export abstract class IntegrationModule<TInstance = unknown, TSection = unknown> {
    abstract readonly type: IntegrationType
    abstract readonly summaryLabel: string
    protected abstract readonly sectionImports: readonly string[]

    abstract fetchInstances(apiKey: string): Promise<TInstance[]>
    abstract instanceId(instance: TInstance): string

    protected abstract prepareSection(input: ModuleRenderInput<TInstance>): Promise<TSection> | TSection

    async render(input: ModuleRenderInput<TInstance>): Promise<ModuleOutput> {
        if (input.instance === undefined && this.requiresInstance) return this.emptyOutput()

        const section = await this.prepareSection(input)
        const toolFile = await this.buildToolFile(input)
        const triggers = this.hasTriggers ? await buildTriggerDeclarationsForBucket(this.triggerBucket) : undefined
        const context = {
            section,
            toolFile,
            triggerDeclarations: triggers?.declarations ?? [],
            ...(await this.extraTemplateContext(input, toolFile))
        }

        const leafFiles: LeafFile[] = []
        if (this.hasSchemas) leafFiles.push(this.renderLeaf("schemas", context))
        leafFiles.push(this.renderLeaf("tools", context))
        if (this.hasTriggers) leafFiles.push(this.renderLeaf("triggers", context))

        return {
            integration: this.type,
            leafFiles,
            sdkImports: [...this.sectionImports, ...(toolFile ? ["TerseAgent"] : [])],
            triggerDeclaredNames: triggers?.declaredNames ?? [],
            triggerExtraImports: triggers?.extraImports ?? [],
            toolboxEntries: toolFile ? [{ key: toolFile.key, integrationType: toolFile.integrationType, typeName: toolFile.typeName, constName: toolFile.constName }] : [],
            triggersAggregateLines: this.triggersAggregateLines,
            skillsAggregateLines: this.skillsAggregateLines
        }
    }

    protected get requiresInstance(): boolean {
        return true
    }

    protected requireInstance(input: ModuleRenderInput<TInstance>): TInstance {
        if (input.instance === undefined) throw new MissingModuleInstanceError(this.type)
        return input.instance
    }

    protected get hasTriggers(): boolean {
        return INTEGRATIONS_WITH_TRIGGERS.has(this.type)
    }

    protected get hasSchemas(): boolean {
        return false
    }

    protected get triggerBucket(): string {
        return this.type
    }

    protected get triggersAggregateLines(): readonly string[] {
        return []
    }

    protected get skillsAggregateLines(): readonly string[] {
        return []
    }

    protected extraTemplateContext(_input: ModuleRenderInput<TInstance>, _toolFile: ToolFileContext | undefined): Promise<Record<string, unknown>> | Record<string, unknown> {
        return {}
    }

    protected async buildToolFile(input: ModuleRenderInput<TInstance>): Promise<ToolFileContext | undefined> {
        const tools = input.tools
        if (tools.length === 0) return undefined

        const needsAutoFill = tools.some(hasAutoFillId)
        const integrationId = input.instance ? this.instanceId(input.instance) : undefined
        if (needsAutoFill && !integrationId) return undefined

        const key: string = this.type
        const declarations = (await Promise.all(tools.map(tool => this.toolDeclarations(tool, input)))).flat()
        const methods = tools.flatMap(tool => this.toolMethods(tool, integrationId, input))

        return {
            key,
            integrationType: key,
            typeName: `${toPascalCase(key)}GeneratedTools`,
            constName: `${toCamelCase(key)}Tools`,
            declarations,
            methods
        }
    }

    protected async toolDeclarations(tool: ToolDefinition, input: ModuleRenderInput<TInstance>): Promise<string[]> {
        const name = tool.name
        if (!isKnownToolName(name)) return []
        const definition = ToolDefinitions[name]

        const printOptions = this.toolParamsPrintOptions(tool, input)
        const paramsDeclaration = printOptions.suppress
            ? undefined
            : await printType({
                  typeName: toolNameToTypeName(name, "Params"),
                  schema: definition.inputSchema,
                  io: "input",
                  description: tool.description || undefined,
                  omitFields: hasAutoFillId(tool) ? ["integrationId"] : undefined,
                  fieldOverrides: printOptions.fieldOverrides
              })
        const resultDeclaration = await printType({
            typeName: toolNameToTypeName(name, "Result"),
            schema: definition.outputSchema,
            io: "output",
            hoisted: [RUN_HISTORY_ACTION_HOIST]
        })
        return [...(paramsDeclaration ? [paramsDeclaration] : []), resultDeclaration]
    }

    protected toolParamsPrintOptions(_tool: ToolDefinition, _input: ModuleRenderInput<TInstance>): ToolParamsPrintOptions {
        return {}
    }

    protected toolMethods(tool: ToolDefinition, integrationId: string | undefined, _input: ModuleRenderInput<TInstance>): ToolMethodContext[] {
        const methodName = toCamelCase(tool.displayName)
        const paramsType = toolNameToTypeName(tool.name, "Params")
        const resultType = toolNameToTypeName(tool.name, "Result")
        const normalizedParamsExpr = this.normalizeParamsExpression(tool)

        const generatedSignature = `${methodName}(params: ${paramsType}): Promise<${resultType}>`

        let runtimeLines: string[]
        if (integrationId && hasAutoFillId(tool)) {
            runtimeLines = [
                `${methodName}: (params: ${paramsType}) =>`,
                `    TerseAgent.executeTool<${resultType}>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}), integrationId: "${escapeString(integrationId)}" }),`
            ]
        } else {
            runtimeLines = [`${methodName}: (params: ${paramsType}) =>`, `    TerseAgent.executeTool<${resultType}>("${escapeString(tool.name)}", { ...(${normalizedParamsExpr}) }),`]
        }

        return [
            {
                description: tool.description || undefined,
                generatedSignature,
                runtimeLines
            }
        ]
    }

    protected normalizeParamsExpression(_tool: ToolDefinition): string {
        return "params"
    }

    selectActiveInstance(instances: readonly TInstance[], activeConnectionId: string | undefined): TInstance | undefined {
        if (activeConnectionId) {
            const match = instances.find(instance => this.instanceId(instance) === activeConnectionId)
            if (match) return match
        }
        return instances[0]
    }

    private renderLeaf(kind: LeafKind, context: object): LeafFile {
        const stem: string = this.type
        return {
            fileName: `${stem}.${kind}.ts`,
            kind,
            body: ModuleTemplateRenderer.getInstance().renderModuleTemplate(stem, `${stem}.${kind}.hbs`, context)
        }
    }

    private emptyOutput(): ModuleOutput {
        return {
            integration: this.type,
            leafFiles: [],
            sdkImports: [],
            triggerDeclaredNames: [],
            triggerExtraImports: [],
            toolboxEntries: [],
            triggersAggregateLines: [],
            skillsAggregateLines: []
        }
    }
}

export class MissingModuleInstanceError extends Error {
    constructor(type: IntegrationType) {
        super(`Integration module "${type}" rendered without an active instance.`)
        this.name = "MissingModuleInstanceError"
    }
}

function hasAutoFillId(tool: ToolDefinition): boolean {
    return (toolsWithIntegrationId as ReadonlySet<string>).has(tool.name)
}

function isKnownToolName(name: string): name is ToolName {
    return name in ToolDefinitions
}

export interface IntegrationInstanceData {
    id: string
    displayName: string
}

export interface ModuleRenderInput<TInstance> {
    readonly instance: TInstance | undefined
    readonly instances: readonly TInstance[]
    readonly tools: readonly ToolDefinition[]
}

export interface ModuleOutput {
    readonly integration: IntegrationType
    readonly leafFiles: readonly LeafFile[]
    readonly sdkImports: readonly string[]
    readonly triggerDeclaredNames: readonly string[]
    readonly triggerExtraImports: readonly string[]
    readonly toolboxEntries: readonly ToolboxEntryContext[]
    readonly triggersAggregateLines: readonly string[]
    readonly skillsAggregateLines: readonly string[]
}

export type LeafKind = "common" | "schemas" | "tools" | "triggers"

export interface LeafFile {
    readonly fileName: string
    readonly kind: LeafKind
    readonly body: string
}

export interface ToolboxEntryContext {
    key: string
    integrationType: string
    typeName: string
    constName: string
}

export interface ToolFileContext extends ToolboxEntryContext {
    declarations: string[]
    methods: ToolMethodContext[]
}

export interface ToolMethodContext {
    description?: string
    generatedSignature: string
    runtimeLines: string[]
}

export interface ToolParamsPrintOptions {
    suppress?: boolean
    fieldOverrides?: Record<string, string>
}
