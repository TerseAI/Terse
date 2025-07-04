// Define the base interface for client-bound tools
export interface ClientBoundTool<T = any> {
    id: string;
    parseParameters(parameters: string): T;
}

// Helper function to create a client-bound tool with type safety
export function createClientBoundTool<T>(tool: Omit<ClientBoundTool<T>, 'parseParameters'>): ClientBoundTool<T> {
    return {
        ...tool,
        parseParameters(parameters: string): T {
            console.log("Parsing parameters", parameters);
            return JSON.parse(parameters) as T;
        }
    };
}

// Define parameter types
export interface ShowTypeToUserParameters {
    items: { type: string, id: string }[];
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

// Create the tools with type safety
export const clientBoundTools = [
    createClientBoundTool<ShowTypeToUserParameters>({
        id: 'Show_Type_To_User',
    }),
    createClientBoundTool<ShowOrganizationSummaryParameters>({
        id: 'Show_User_Provided_Organization_Summary',
    }),
    createClientBoundTool<ShowOrganizationNameParameters>({
        id: 'Show_Organization_Name',
    }),
    createClientBoundTool<CreateOrganizationParameters>({
        id: 'Create_Organization',
    }),
    createClientBoundTool<SetComponentsForOrganizationParameters>({
        id: 'Set_Components_For_Organization',
    }),
    createClientBoundTool<RequestConfirmationParameters>({
        id: 'Request_Confirmation',
    }),
    createClientBoundTool<InviteUsersParameters>({
        id: 'Set_Users_For_Organization',
    }),
] as const;

// Extract the tool IDs for runtime checking
export const clientBoundToolIds = clientBoundTools.map(tool => tool.id);