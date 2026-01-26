import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { run, RunState, RunToolApprovalItem, StreamedRunResult } from "@openai/agents";
import { Request, Response } from "express";
import { Jwt } from "../utility/jwt";
import { AgentSession } from "./agents/Agent";
import { transformAgentStreamToModelEvents } from "./streaming";
import type { Session } from "../types/session";
import { ModelEvent, ModelRequest, SendModelRequest } from "../shared/ModelEvents";
import { IAgentSession } from "./agents/AgentSession";
import { getUserTicketManager } from "../types/user";
import logger from "../logger";

// invoke with
// const agentSocketServer = new (server, "/session");

export class AgentSocketServer {
    private wss: WebSocketServer;
    private pending: WeakMap<WebSocket, { state: RunState<any, any>; interruption: RunToolApprovalItem }> = new WeakMap();

    constructor(http: HttpServer, path = "/session") {
        this.wss = new WebSocketServer({ server: http, path });
        this.wss.on("connection", this.handle);
    }

    private handle = async (ws: WebSocket, req: Request) => {
        logger.info("🔌 Connection Request URL: ", {url: JSON.stringify(req.url)});

        // check if token is in url
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        const agentType = url.searchParams.get('type') || "chat";
        logger.info("🔌 Agent type: ", {agentType});

        if (!token) {
            logger.error('❌ No token found. Unable to authenticate user.');
            ws.close(1008, "Unauthorized");
            return;
        }

        // Authenticate the user from cookies
        const session = await this.authenticateUser(token);
        if (!session) {
            logger.error('❌ Invalid token. Unable to authenticate user. Closing connection.');
            ws.close(1008, "Unauthorized");
            return;
        }

        logger.info("🔌 New WebSocket connection established: ", {agentType});


        // Keep per-socket state here
        let abortCurrent = new AbortController();
        let agent: IAgentSession<any>;
        agent = new AgentSession(session);


        ws.on("message", async raw => {
            let modelRequest: ModelRequest;
            try {
                modelRequest = JSON.parse(raw.toString());
            } catch (error) {
                logger.error('Failed to parse WebSocket message', { error });
                ws.send(JSON.stringify({ type: 'Failure', error: 'Invalid JSON format' }));
                return;
            }

            logger.info("🔌 Message received", {modelRequest});

            if (modelRequest.type === "SendModelRequest") {
                let sendModelRequest: SendModelRequest = modelRequest;
                await agent.push(sendModelRequest);
                const result: StreamedRunResult<any, any> = await agent.run();
                await this.streamResultWithInterruptions(ws, agent, result);
            } else if (modelRequest.type === "ToolApprovalResponse") {
                logger.info("🔌 Tool approval response", {modelRequest});
                const pending = this.pending.get(ws);
                if (!pending) {
                    logger.error('No pending interruption to handle');
                    return;
                }

                const { step_id, approved } = modelRequest;
                if (step_id !== (pending.interruption.rawItem as any).callId) {
                    logger.error('Step id mismatch', { step_id, callId: (pending.interruption.rawItem as any).callId });
                    return;
                }

                if (approved) {
                    pending.state.approve(pending.interruption);
                } else {
                    pending.state.reject(pending.interruption);
                }

                const resumed: StreamedRunResult<any, any> = await run(agent.getAgent(), pending.state, { stream: true });
                this.pending.delete(ws);
                logger.info("🔌 Resumed");
                await this.streamResultWithInterruptions(ws, agent, resumed);
            } else {
                logger.error('Unknown request', { requestType: (modelRequest as any).type });
                ws.send(JSON.stringify({ type: 'Failure', error: 'Unknown request' }));
            }
        });

        ws.on("close", () => abortCurrent.abort());
    };

    private async streamResultWithInterruptions(ws: WebSocket, agent: IAgentSession<any>, result: StreamedRunResult<any, any>) {
        const eventStream = transformAgentStreamToModelEvents(result, {
            onToolCallComplete: (callId) => agent.flushPendingActions?.(callId) || Promise.resolve([]),
        });
        
        for await (const event of eventStream) {
            this.sendMessage(ws, event);
        }

        if (result.interruptions && result.interruptions.length > 0) {
            const interruption: RunToolApprovalItem = result.interruptions[0] as RunToolApprovalItem;
            logger.info("🔌 Interruption, requesting approval", {interruptionName: interruption.name});
            this.pending.set(ws, { state: result.state, interruption });
            this.sendMessage(ws, {
                type: 'ToolApprovalRequest',
                step_id: (interruption.rawItem as any).callId,
                name: interruption.name,
                arguments: interruption.arguments
            } as ModelEvent);
            return;
        }

        logger.info("🔌 Result final output", {finalOutput: result.finalOutput});

        agent.setHistory(result.history);
        
        // NaturalStop is already sent by toEventStream
    }

    private async sendMessage(ws: WebSocket, message: ModelEvent) {
        ws.send(JSON.stringify(message));
    }

    private async authenticateUser(token: string): Promise<Session | null> {
        const user = await new Jwt().verify(token);
        if (!user) {
            logger.error('❌ Invalid token. Unable to authenticate user.');
            return null;
        }

        const ticketManager = await getUserTicketManager(user.id);
        if (!ticketManager) {
            logger.error('❌ Unable to get ticket manager. Unable to authenticate user.', { userId: user.id });
            return null;
        }

        const teams = await ticketManager.getTeams();
        // HACK: Force the first team to be the default team
        const teamId = teams[0].id;

        return {
            user: user,
            isUserInitiated: true,
            ticketManager: ticketManager,
            // teamId: teamId,
            currentUser: await ticketManager.me() || undefined,
        };
    }
}


export async function requestSessionSocketToken(req: Request, res: Response) {
    try {
        let user = req.session?.user;
        const token = await new Jwt().sign(user.id);
        res.json(token);
    } catch (error) {
        logger.error('Failed to request session socket token', { error });
        res.status(500).json({ error: 'Failed to request session socket token' });
    }
}