export interface ClientBoundTool<T = any> {
    id: string;
    parseParameters(parameters: string): T;
}
export declare function createClientBoundTool<T>(tool: Omit<ClientBoundTool<T>, 'parseParameters'>): ClientBoundTool<T>;
export interface ShowTypeToUserParameters {
    items: {
        type: string;
        id: string;
    }[];
}
export interface ShowOrganizationSummaryParameters {
    description: string;
}
export interface ShowOrganizationNameParameters {
    name: string;
}
export interface CreateOrganizationParameters {
    name: string;
    description: string;
}
export interface SetComponentsForOrganizationParameters {
    components: string[];
}
export interface RequestConfirmationParameters {
    message: string;
}
export interface InviteUsersParameters {
    inOrg: string[];
    notInOrg: string[];
    currentUser: string;
    currentUserInList: boolean;
    inInvitations: string[];
}
export declare const clientBoundTools: readonly [ClientBoundTool<ShowTypeToUserParameters>, ClientBoundTool<ShowOrganizationSummaryParameters>, ClientBoundTool<ShowOrganizationNameParameters>, ClientBoundTool<CreateOrganizationParameters>, ClientBoundTool<SetComponentsForOrganizationParameters>, ClientBoundTool<RequestConfirmationParameters>, ClientBoundTool<InviteUsersParameters>];
export declare const clientBoundToolIds: string[];
//# sourceMappingURL=ClientBoundTools.d.ts.map