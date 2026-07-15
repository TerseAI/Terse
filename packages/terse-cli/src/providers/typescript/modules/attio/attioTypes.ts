export interface AttioAttributeData {
    api_slug?: string
    title?: string
    type?: string
    is_required?: boolean
    is_unique?: boolean
    is_multiselect?: boolean
    options?: string[]
}

export interface AttioObjectData {
    id: { workspace_id: string; object_id: string }
    api_slug: string
    singular_noun: string
    plural_noun?: string
    attributes?: AttioAttributeData[]
}

export interface AttioListData {
    id: { workspace_id?: string; list_id: string }
    api_slug: string
    name: string
    parent_object?: string[] | string
    attributes?: AttioAttributeData[]
}

export interface AttioInstanceData {
    id: string
    displayName: string
    objects: AttioObjectData[]
    lists: AttioListData[]
}
