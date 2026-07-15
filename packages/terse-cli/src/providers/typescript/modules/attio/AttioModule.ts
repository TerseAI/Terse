import type { AttioIntegration, ToolDefinition } from "terse-types"
import { ApiRoutes, IntegrationType, buildRoute } from "terse-types"

import { fetchWithAuth } from "../../../../api.js"
import { IntegrationModule, type ModuleRenderInput, type ToolMethodContext } from "../IntegrationModule.js"
import { buildSkillToolType, escapeString, toGeneratedIdentifier } from "../moduleHelpers.js"

import {
    attioIsMultiValue,
    attioListValueTypeNames,
    attioObjectValueTypeNames,
    buildAttioObjectTypeDeclarations,
    buildAttioRecordTriggerAliases,
    buildAttioToolTypeDeclarations,
    buildAttioValueTypeDeclarations
} from "./attioProjection.js"
import { buildAttioToolMethods } from "./attioToolMethods.js"
import type { AttioAttributeData, AttioInstanceData, AttioListData } from "./attioTypes.js"

export class AttioModule extends IntegrationModule<AttioInstanceData, AttioSectionContext> {
    readonly type = IntegrationType.ATTIO
    readonly summaryLabel = "Attio"
    protected readonly sectionImports = ["registerEventTransform", "AttioOutputConfig", "TypedSkill", "AttioInputConfig", "AttioEventType", "TypedTrigger"]

    async fetchInstances(apiKey: string): Promise<AttioInstanceData[]> {
        const instances = await fetchWithAuth<AttioIntegration[]>(ApiRoutes.ATTIO.INTEGRATIONS, apiKey)
        return Promise.all(
            instances.map(async (inst): Promise<AttioInstanceData> => {
                const objects = await fetchWithAuth<AttioInstanceData["objects"]>(buildRoute(ApiRoutes.ATTIO.OBJECTS, { integrationId: inst.id }), apiKey).catch(
                    () => [] as AttioInstanceData["objects"]
                )
                const lists = await fetchWithAuth<AttioListData[]>(buildRoute(ApiRoutes.ATTIO.LISTS, { integrationId: inst.id }), apiKey).catch(() => [] as AttioListData[])
                return {
                    id: inst.id,
                    displayName: inst.workspaceName || inst.id,
                    objects: Array.isArray(objects) ? objects : [],
                    lists: Array.isArray(lists) ? lists : []
                }
            })
        )
    }

    instanceId(instance: AttioInstanceData): string {
        return instance.id
    }

    protected get hasSchemas(): boolean {
        return true
    }

    protected get triggersAggregateLines(): readonly string[] {
        return ["    attio: attioTriggers,"]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return ["    /** Attio — query and upsert records on a CRM object */", "    attio: attioSkill,"]
    }

    protected async prepareSection(input: ModuleRenderInput<AttioInstanceData>): Promise<AttioSectionContext> {
        const inst = this.requireInstance(input)
        const objects = buildGeneratedAttioObjects(inst)
        const lists = buildGeneratedAttioLists(inst)
        const valueTypeLines = [...(await buildAttioValueTypeDeclarations()), ...(await buildAttioObjectTypeDeclarations(objects, lists)), ...attioOptionConstLines(objects, lists)]
        return {
            id: inst.id,
            skillToolType: buildSkillToolType(input.tools),
            objects,
            lists,
            valueTypeLines,
            recordTriggerAliases: buildAttioRecordTriggerAliases(objects)
        }
    }

    protected toolDeclarations(): Promise<string[]> {
        return Promise.resolve([])
    }

    protected toolMethods(tool: ToolDefinition, integrationId: string | undefined, input: ModuleRenderInput<AttioInstanceData>): ToolMethodContext[] {
        if (integrationId) {
            const attioMethods = buildAttioToolMethods(integrationId, tool)
            if (attioMethods) return attioMethods
        }
        return super.toolMethods(tool, integrationId, input)
    }

    protected async extraTemplateContext(input: ModuleRenderInput<AttioInstanceData>): Promise<Record<string, unknown>> {
        const toolTypeDeclarations = input.tools.length > 0 ? await buildAttioToolTypeDeclarations(input.tools.map(tool => tool.name)) : []
        return { toolTypeDeclarations }
    }
}

function buildGeneratedAttioObjects(inst: AttioInstanceData): AttioObjectContext[] {
    const usedNames = new Set<string>()

    return inst.objects.map(object => {
        let staticName = toGeneratedIdentifier(object.singular_noun || object.api_slug || "Object", "AttioObject")
        while (usedNames.has(staticName)) staticName += "_"
        usedNames.add(staticName)

        const attributes = (object.attributes || []).filter((attr): attr is Required<Pick<AttioAttributeData, "api_slug">> & AttioAttributeData => !!attr.api_slug)

        return {
            staticName,
            apiSlug: object.api_slug,
            objectId: object.id.object_id,
            singularNoun: object.singular_noun,
            attributeSource: renderAttioAttributeSource(attributes),
            recordValuesType: attioObjectValueTypeNames(staticName).record,
            inputValuesType: attioObjectValueTypeNames(staticName).input,
            multiValueSlugsText: renderMultiValueSlugs(attributes),
            attributes
        }
    })
}

function buildGeneratedAttioLists(inst: AttioInstanceData): AttioListContext[] {
    const usedNames = new Set<string>()

    return inst.lists.map(list => {
        let staticName = toGeneratedIdentifier(list.name || list.api_slug || "List", "AttioList")
        while (usedNames.has(staticName)) staticName += "_"
        usedNames.add(staticName)

        const attributes = (list.attributes || []).filter((attr): attr is Required<Pick<AttioAttributeData, "api_slug">> & AttioAttributeData => !!attr.api_slug)
        const parentObject = Array.isArray(list.parent_object) ? list.parent_object[0] || "" : list.parent_object || ""

        return {
            staticName,
            apiSlug: list.api_slug,
            name: list.name,
            listId: list.id.list_id,
            parentObject,
            attributeSource: renderAttioAttributeSource(attributes),
            entryValuesType: attioListValueTypeNames(staticName).entry,
            entryRecordValuesType: attioListValueTypeNames(staticName).entryRecord,
            multiValueSlugsText: renderMultiValueSlugs(attributes),
            attributes
        }
    })
}

function renderMultiValueSlugs(attributes: Array<AttioAttributeData & { api_slug: string }>): string {
    return attributes
        .filter(attioIsMultiValue)
        .map(attr => `"${escapeString(attr.api_slug)}"`)
        .join(", ")
}

function renderAttioAttributeSource(attributes: Array<AttioAttributeData & { api_slug: string }>): string {
    if (attributes.length === 0) return "[]"
    return `[\n${attributes
        .map(attr => {
            const fields = [
                `apiSlug: "${escapeString(attr.api_slug)}"`,
                attr.title ? `title: "${escapeString(attr.title)}"` : undefined,
                attr.type ? `type: "${escapeString(attr.type)}"` : undefined,
                attr.is_required !== undefined ? `isRequired: ${attr.is_required ? "true" : "false"}` : undefined,
                attr.is_unique !== undefined ? `isUnique: ${attr.is_unique ? "true" : "false"}` : undefined
            ]
                .filter(Boolean)
                .join(", ")
            return `        { ${fields} }`
        })
        .join(",\n")}\n    ]`
}

function attioOptionConstLines(objects: readonly AttioObjectContext[], lists: readonly AttioListContext[]): string[] {
    const lines: string[] = []

    const usedConstNames = new Set<string>()
    for (const object of [...objects, ...lists]) {
        for (const attr of object.attributes) {
            if (!attr.options || attr.options.length === 0) continue
            let attrName = toGeneratedIdentifier(attr.title || attr.api_slug, "Attribute")
            if (attrName.startsWith(object.staticName) && attrName.length > object.staticName.length) {
                attrName = attrName.slice(object.staticName.length)
            }
            let constName = `Attio${object.staticName}${attrName}`
            while (usedConstNames.has(constName)) constName += "_"
            usedConstNames.add(constName)
            lines.push("", `export const ${constName} = {`)
            const usedKeys = new Set<string>()
            for (const title of attr.options) {
                let key = toGeneratedIdentifier(title, "Option")
                while (usedKeys.has(key)) key += "_"
                usedKeys.add(key)
                lines.push(`    ${key}: "${escapeString(title)}",`)
            }
            lines.push("} as const")
        }
    }

    return lines
}

interface AttioObjectContext {
    staticName: string
    apiSlug: string
    objectId: string
    singularNoun: string
    attributeSource: string
    recordValuesType: string
    inputValuesType: string
    multiValueSlugsText: string
    attributes: Array<AttioAttributeData & { api_slug: string }>
}

interface AttioListContext {
    staticName: string
    apiSlug: string
    name: string
    listId: string
    parentObject: string
    attributeSource: string
    entryValuesType: string
    entryRecordValuesType: string
    multiValueSlugsText: string
    attributes: Array<AttioAttributeData & { api_slug: string }>
}

export interface AttioSectionContext {
    id: string
    skillToolType: string
    objects: AttioObjectContext[]
    lists: AttioListContext[]
    valueTypeLines: string[]
    recordTriggerAliases: string[]
}
