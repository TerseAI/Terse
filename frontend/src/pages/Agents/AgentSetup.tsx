import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useTemplates } from '@/hooks/api/useTemplates';
import { TemplateCard } from '@/components/Agents/TemplateCard';
import { Card, CardContent } from '@/components/ui/card';
import { Chat } from '@/components/chat/Chat';
import { subscribeToBuilderChat, sendBuilderMessage } from '@/socket';
import { ModelRequest, SendModelRequest } from '@/shared/ModelEvents';
import { ChatEventPayload } from '@/components/chat/hooks/useCompletionSocket';

export default function AgentSetup() {
    const { templates, isLoading } = useTemplates();
    const [hasStartedChat, setHasStartedChat] = useState(false);

    // Generate a session ID for this setup flow
    const sessionId = useMemo(() => uuidv4(), []);

    const subscribeToEvents = useCallback((callback: (payload: ChatEventPayload) => void) => {
        const unsubscribe = subscribeToBuilderChat(sessionId, (payload) => {
            callback({
                runHistoryModelEvent: payload.event,
            });
        });
        return unsubscribe;
    }, [sessionId]);

    const sendMessage = useCallback((message: ModelRequest) => {
        // Mark that the user has started chatting
        if (!hasStartedChat) {
            setHasStartedChat(true);
        }

        if (message.type === 'SendModelRequest') {
            const enrichedMessage: { type: 'SendModelRequest' } & SendModelRequest = {
                ...message,
                ui_state: JSON.stringify({ page: 'agent-setup' }),
            };
            sendBuilderMessage(sessionId, enrichedMessage);
        } else {
            sendBuilderMessage(sessionId, message);
        }
    }, [sessionId, hasStartedChat]);

    const handleUserMessage = useCallback(() => {
        if (!hasStartedChat) {
            setHasStartedChat(true);
        }
    }, [hasStartedChat]);

    // Animation configuration
    const animationDuration = 0.5;
    const animationEase = [0.4, 0, 0.2, 1]; // ease-in-out cubic bezier

    return (
        <div className="flex flex-col h-full w-full">
            {/* Chat Section - expands when chat starts */}
            <motion.div
                className="flex flex-col mx-auto max-w-5xl w-full"
                initial={false}
                animate={{
                    flexGrow: hasStartedChat ? 1 : 0,
                    minHeight: hasStartedChat ? 0 : undefined,
                    height: hasStartedChat ? 'auto' : 280,
                }}
                transition={{
                    duration: animationDuration,
                    ease: animationEase,
                }}
            >
                <div className="flex-1 min-h-0 w-full">
                    <Chat
                        key={sessionId}
                        subscribeToEvents={subscribeToEvents}
                        sendMessage={sendMessage}
                        onUserMessage={handleUserMessage}
                        addUserTurnsLocally={true}
                        inputSize={hasStartedChat ? "small" : "large"}
                    />
                </div>
            </motion.div>

            {/* Templates Section - fades and blurs away when chat starts */}
            <AnimatePresence>
                {!hasStartedChat && (
                    <motion.div
                        initial={{ opacity: 1, filter: 'blur(0px)' }}
                        exit={{
                            opacity: 0,
                            filter: 'blur(8px)',
                            y: 20,
                        }}
                        transition={{
                            duration: animationDuration,
                            ease: animationEase,
                        }}
                        className="overflow-hidden"
                    >
                        <div className="p-6">
                            <div className="mx-auto max-w-5xl space-y-4">
                                {/* Divider with "or" */}
                                <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="text-sm text-muted-foreground">or start with a template</span>
                                    <div className="h-px flex-1 bg-border" />
                                </div>

                                {/* Templates Grid */}
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : templates.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {templates.map((template, index) => (
                                            <TemplateCard
                                                key={index}
                                                template={template}
                                                templateIndex={index}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Card className="border-dashed">
                                        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                                            <p className="text-muted-foreground text-sm">
                                                No templates available yet
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
