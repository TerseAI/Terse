import { Server as HttpServer } from "http";
import { Request, Response } from "express";
export declare class AgentSocketServer {
    private wss;
    private pending;
    constructor(http: HttpServer, path?: string);
    private handle;
    private streamResultWithInterruptions;
    private sendMessage;
    private authenticateUser;
}
export declare function requestSessionSocketToken(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=socket.d.ts.map