import { Request, Response } from "express";
export declare function getCurrentGithubIntegration(req: Request, res: Response): Promise<void>;
export declare function getInstallationUrl(req: Request, res: Response): Promise<void>;
export declare function githubAppInstallationCallback(req: Request, res: Response): Promise<void>;
export declare function githubAppInstallationDeleted(req: Request, res: Response): Promise<void>;
export declare function githubAppRecievedCommit(req: Request, res: Response): Promise<void>;
export declare function githubAppRecievedPush(req: Request, res: Response): Promise<void>;
export declare function githubAppRecievedPullRequest(req: Request, res: Response): Promise<void>;
export declare function githubAppRecievedIssueComment(req: Request, res: Response): Promise<void>;
declare const _default: {
    getInstallationUrl: typeof getInstallationUrl;
};
export default _default;
//# sourceMappingURL=githubApp.d.ts.map