// Helper function to create a client-bound tool with type safety
export function createClientBoundTool(tool) {
    return {
        ...tool,
        parseParameters(parameters) {
            console.log("Parsing parameters", parameters);
            return JSON.parse(parameters);
        }
    };
}
// Create the tools with type safety
export const clientBoundTools = [
    createClientBoundTool({
        id: 'Show_Type_To_User',
    }),
    createClientBoundTool({
        id: 'Show_User_Provided_Organization_Summary',
    }),
    createClientBoundTool({
        id: 'Show_Organization_Name',
    }),
    createClientBoundTool({
        id: 'Create_Organization',
    }),
    createClientBoundTool({
        id: 'Set_Components_For_Organization',
    }),
    createClientBoundTool({
        id: 'Request_Confirmation',
    }),
    createClientBoundTool({
        id: 'Set_Users_For_Organization',
    }),
];
// Extract the tool IDs for runtime checking
export const clientBoundToolIds = clientBoundTools.map(tool => tool.id);
//# sourceMappingURL=ClientBoundTools.js.map