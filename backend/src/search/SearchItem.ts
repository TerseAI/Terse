// Search item structure
export interface SearchItem {
    id: string; // uuid, simple DB id
    teamId: string; // This is used as a filter. Should be a uuid. Project Id. for Linear
    entityType: string; // ticket, comment, user, etc.
    entityId: string; // this is the id of what is being indexed
    content: string; // The content of the search item
    metadata: Record<string, any>; // Additional metadata for the search item
}