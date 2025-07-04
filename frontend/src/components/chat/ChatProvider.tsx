import { ReactNode, useState } from 'react';
import { ConnectionType, useCompletionSocket } from './useCompletionSocket';
import { useChatTurns } from './hooks/useChatTurns';
import { useChatInput } from './hooks/useChatInput';
import { useInitialMessage } from './hooks/useInitialMessage';
import { ChangedItem, ModelRequest } from '../../shared/ModelEvents';
import { ApprovalButtons } from './ApprovalButtons';

interface ChatProviderProps {
    connectionType: ConnectionType;
    initialMessage?: ModelRequest;
    onToolApprovalRequest?: (req: { step_id: string; name: string; arguments: string }) => void;
    onUserMessage?: (message: string) => void;
    onToolCall?: (req: { summary: string; step_id: string; parameters: string }, addCustomSnippet: (step_id: string, snippet: ReactNode) => void) => void;
    onToolCallComplete?: (req: { tool_name: string; status: string; step_id: string; changed_items: ChangedItem[] }) => void;
    children: (props: {
        turns: any[];
        isPendingAssistantResponse: boolean;
        messagesEndRef: React.RefObject<HTMLDivElement | null>;
        input: string;
        setInput: (input: string) => void;
        sendMessage: (message: string) => void;
        customInput?: ReactNode;
    }) => ReactNode;
}

export function ChatProvider({
    connectionType,
    initialMessage,
    onToolApprovalRequest,
    onUserMessage,
    onToolCall,
    onToolCallComplete,
    children
}: ChatProviderProps) {
    const [approvalRequest, setApprovalRequest] = useState<{
        step_id: string;
        name: string;
        arguments: string;
        message: string;
    } | null>(null);

    const {
        turns,
        isPendingAssistantResponse,
        messagesEndRef,
        handleDelta,
        handleToolCall,
        handleToolApprovalRequest,
        handleToolApprovalResponse,
        handleToolCallComplete,
        handleFailure,
        handleNaturalStop,
        addUserTurn,
        addCustomSnippet
    } = useChatTurns();

    const connection = useCompletionSocket({
        connectionType,
        onDelta: handleDelta,
        onToolCall: (req) => {
            handleToolCall(req);
            onToolCall?.(req, addCustomSnippet);
        },
        onToolCallComplete: (req) => {
            handleToolCallComplete(req);
            onToolCallComplete?.(req);
        },
        onFailure: handleFailure,
        onNaturalStop: handleNaturalStop,
        onToolApprovalRequest: (req) => {
            // Handle the approval request in the turns state
            handleToolApprovalRequest(req);
            // Set the approval request state to show the approval buttons
            setApprovalRequest({
                ...req,
                message: getApprovalMessage(req.name, req.arguments)
            });
            onToolApprovalRequest?.(req);
        }
    });

    const { input, setInput, sendMessage } = useChatInput({
        connection,
        onUserMessage: (message) => {
            addUserTurn(message);
            onUserMessage?.(message);
        }
    });

    // Helper function to generate approval messages
    const getApprovalMessage = (name: string, args: string): string => {
        try {
            const parsedArgs = JSON.parse(args);
            
            switch (name) {
                case 'Create_Ticket':
                    const title = parsedArgs.title || 'this ticket';
                    return `Are you sure you want to create "${title}"?`;
                case 'Delete_Ticket':
                    return 'Are you sure you want to delete this ticket? This action cannot be undone.';
                case 'Update_Ticket':
                    return 'Are you sure you want to update this ticket?';
                case 'Execute_Import':
                    return 'Are you sure you want to execute the import? This will create tickets in your system.';
                default:
                    return `Are you sure you want to execute ${name}?`;
            }
        } catch (error) {
            // If we can't parse the arguments, fall back to generic message
            switch (name) {
                case 'Create_Ticket':
                    return 'Are you sure you want to create this ticket?';
                case 'Delete_Ticket':
                    return 'Are you sure you want to delete this ticket?';
                case 'Update_Ticket':
                    return 'Are you sure you want to update this ticket?';
                case 'Execute_Import':
                    return 'Are you sure you want to execute the import?';
                default:
                    return `Are you sure you want to execute ${name}?`;
            }
        }
    };

    // Handle approval responses
    const handleApproval = (approved: boolean) => {
        if (approvalRequest && connection.connection) {
            // Update the turns state to reflect the approval response
            handleToolApprovalResponse({
                step_id: approvalRequest.step_id,
                approved
            });
            
            // Send the response to the backend
            connection.connection.sendMessage({
                type: 'ToolApprovalResponse',
                step_id: approvalRequest.step_id,
                approved
            });
            setApprovalRequest(null);
        }
    };

    // Send initial message if provided
    if (initialMessage) {
        useInitialMessage({
            connection,
            message: initialMessage,
            enabled: turns.length === 0
        });
    }

    // Create custom input for approval requests
    const customInput = approvalRequest ? (
        <ApprovalButtons
            message={approvalRequest.message}
            onApprove={() => handleApproval(true)}
            onReject={() => handleApproval(false)}
        />
    ) : undefined;

    return (
        <>
            {children({
                turns,
                isPendingAssistantResponse,
                messagesEndRef,
                input,
                setInput,
                sendMessage,
                customInput
            })}
        </>
    );
} 