import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioAttributeSchema, attioObjectSchema, attioSelectOptionEntitySchema, attioStatusSchema } from "terse-types"
import type { AttioAttribute, AttioSchemaRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioRequestData, parseOptionalJsonObject, resolveAttioAccessToken } from "./attioApi"

export const attioSchemaTool = defineSessionTool({
    name: "attio_schema",
    description: `Read and change the Attio workspace schema. Read actions: 'list_objects' (all object types with attributes — call before creating/updating records), 'get_object', 'list_attributes', 'list_statuses' (e.g. deal stages), 'list_select_options'. Write actions (these change the workspace for every user): 'create_object', 'update_object', 'create_attribute', 'update_attribute', 'create_status', 'update_status', 'create_select_option', 'update_select_option'. Attributes on lists use target 'lists'; on objects, target 'objects'. After schema writes, rerun terse generate to refresh generated types/constants.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_schema tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeSchemaRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_schema", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeSchemaRequest(request: AttioSchemaRequest, accessToken: string): Promise<AttioSchemaOutput> {
    switch (request.action) {
        case "list_objects":
            return listObjects(request.action, accessToken)
        case "get_object": {
            const object = await attioRequestData(accessToken, `/objects/${encodeURIComponent(request.objectSlug)}`, attioObjectSchema, "object")
            return {
                success: true,
                action: request.action,
                object,
                actions: [schemaAction("Fetched object", request.objectSlug, "Fetched object configuration", RunHistoryActionType.read)]
            }
        }
        case "create_object": {
            const body = { data: { api_slug: request.apiSlug, singular_noun: request.singularNoun, plural_noun: request.pluralNoun } }
            const object = await attioRequestData(accessToken, "/objects", attioObjectSchema, "object", { method: "POST", body })
            return {
                success: true,
                action: request.action,
                object,
                actions: [schemaAction("Created object", request.apiSlug, `Created custom object "${request.singularNoun}"`, RunHistoryActionType.create)]
            }
        }
        case "update_object": {
            const updates: Record<string, unknown> = {}
            if (request.newApiSlug != null) updates.api_slug = request.newApiSlug
            if (request.singularNoun != null) updates.singular_noun = request.singularNoun
            if (request.pluralNoun != null) updates.plural_noun = request.pluralNoun
            const object = await attioRequestData(accessToken, `/objects/${encodeURIComponent(request.objectSlug)}`, attioObjectSchema, "object", { method: "PATCH", body: { data: updates } })
            return {
                success: true,
                action: request.action,
                object,
                actions: [schemaAction("Updated object", request.objectSlug, "Updated object configuration", RunHistoryActionType.update)]
            }
        }
        case "list_attributes": {
            const attributes = await attioRequestData(accessToken, `${targetPath(request)}/attributes`, z.array(attioAttributeSchema), "attributes")
            return {
                success: true,
                action: request.action,
                attributes,
                count: attributes.length,
                actions: [schemaAction("Listed attributes", request.identifier, `Found ${attributes.length} attribute(s)`, RunHistoryActionType.read)]
            }
        }
        case "create_attribute": {
            const body = {
                data: {
                    title: request.title,
                    api_slug: request.apiSlug,
                    type: request.attributeType,
                    description: null,
                    is_required: request.isRequired ?? false,
                    is_unique: request.isUnique ?? false,
                    is_multiselect: request.isMultiselect ?? false,
                    config: parseOptionalJsonObject(request.config, "config") ?? {}
                }
            }
            const attribute = await attioRequestData(accessToken, `${targetPath(request)}/attributes`, attioAttributeSchema, "attribute", { method: "POST", body })
            return {
                success: true,
                action: request.action,
                attribute,
                actions: [schemaAction("Created attribute", `${request.identifier}/${request.apiSlug}`, `Created ${request.attributeType} attribute "${request.title}"`, RunHistoryActionType.create)]
            }
        }
        case "update_attribute": {
            const updates: Record<string, unknown> = {}
            if (request.title != null) updates.title = request.title
            if (request.isRequired != null) updates.is_required = request.isRequired
            const attribute = await attioRequestData(accessToken, `${attributePath(request)}`, attioAttributeSchema, "attribute", { method: "PATCH", body: { data: updates } })
            return {
                success: true,
                action: request.action,
                attribute,
                actions: [schemaAction("Updated attribute", `${request.identifier}/${request.attributeSlug}`, "Updated attribute configuration", RunHistoryActionType.update)]
            }
        }
        case "list_statuses": {
            const statuses = await attioRequestData(accessToken, `${attributePath(request)}/statuses`, z.array(attioStatusSchema), "statuses")
            return {
                success: true,
                action: request.action,
                statuses,
                count: statuses.length,
                actions: [schemaAction("Listed statuses", `${request.identifier}/${request.attributeSlug}`, `Found ${statuses.length} status(es)`, RunHistoryActionType.read)]
            }
        }
        case "create_status": {
            const status = await attioRequestData(accessToken, `${attributePath(request)}/statuses`, attioStatusSchema, "status", { method: "POST", body: { data: { title: request.title } } })
            return {
                success: true,
                action: request.action,
                status,
                actions: [schemaAction("Created status", `${request.identifier}/${request.attributeSlug}`, `Added status "${request.title}"`, RunHistoryActionType.create)]
            }
        }
        case "update_status": {
            const updates: Record<string, unknown> = {}
            if (request.title != null) updates.title = request.title
            if (request.isArchived != null) updates.is_archived = request.isArchived
            const status = await attioRequestData(accessToken, `${attributePath(request)}/statuses/${encodeURIComponent(request.statusId)}`, attioStatusSchema, "status", {
                method: "PATCH",
                body: { data: updates }
            })
            return {
                success: true,
                action: request.action,
                status,
                actions: [schemaAction("Updated status", request.statusId, "Updated status", RunHistoryActionType.update)]
            }
        }
        case "list_select_options": {
            const selectOptions = await attioRequestData(accessToken, `${attributePath(request)}/options`, z.array(attioSelectOptionEntitySchema), "select options")
            return {
                success: true,
                action: request.action,
                selectOptions,
                count: selectOptions.length,
                actions: [schemaAction("Listed select options", `${request.identifier}/${request.attributeSlug}`, `Found ${selectOptions.length} option(s)`, RunHistoryActionType.read)]
            }
        }
        case "create_select_option": {
            const selectOption = await attioRequestData(accessToken, `${attributePath(request)}/options`, attioSelectOptionEntitySchema, "select option", { method: "POST", body: { data: { title: request.title } } })
            return {
                success: true,
                action: request.action,
                selectOption,
                actions: [schemaAction("Created select option", `${request.identifier}/${request.attributeSlug}`, `Added option "${request.title}"`, RunHistoryActionType.create)]
            }
        }
        case "update_select_option": {
            const updates: Record<string, unknown> = {}
            if (request.title != null) updates.title = request.title
            if (request.isArchived != null) updates.is_archived = request.isArchived
            const selectOption = await attioRequestData(accessToken, `${attributePath(request)}/options/${encodeURIComponent(request.optionId)}`, attioSelectOptionEntitySchema, "select option", {
                method: "PATCH",
                body: { data: updates }
            })
            return {
                success: true,
                action: request.action,
                selectOption,
                actions: [schemaAction("Updated select option", request.optionId, "Updated select option", RunHistoryActionType.update)]
            }
        }
        default:
            throw request satisfies never
    }
}

async function listObjects(action: "list_objects", accessToken: string): Promise<AttioSchemaOutput> {
    const objects = await attioRequestData(accessToken, "/objects", z.array(attioObjectSchema), "objects")

    const objectsWithAttributes = await Promise.all(
        objects.map(async object => {
            const attributes = await attioRequestData(accessToken, `/objects/${encodeURIComponent(object.api_slug)}/attributes`, z.array(attioAttributeSchema), "attributes").catch(
                (): AttioAttribute[] => []
            )
            return { ...object, attributes }
        })
    )

    return {
        success: true,
        action,
        objects: objectsWithAttributes,
        count: objectsWithAttributes.length,
        actions: [schemaAction("Listed objects", "Attio workspace", `Found ${objectsWithAttributes.length} object type(s)`, RunHistoryActionType.read)]
    }
}

function targetPath(request: { target: "objects" | "lists"; identifier: string }): string {
    return `/${request.target}/${encodeURIComponent(request.identifier)}`
}

function attributePath(request: { target: "objects" | "lists"; identifier: string; attributeSlug: string }): string {
    return `${targetPath(request)}/attributes/${encodeURIComponent(request.attributeSlug)}`
}

function schemaAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioSchemaOutput = ToolOutputByName["attio_schema"]
