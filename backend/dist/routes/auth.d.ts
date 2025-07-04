import { NextFunction, Request, Response } from "express";
export declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function me(req: Request, res: Response): Promise<void>;
export declare function login(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function logout(req: Request, res: Response): void;
export declare function githubLogin(req: Request, res: Response): Promise<void>;
export declare function githubCallback(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
declare const _default: {
    me: typeof me;
    login: typeof login;
    logout: typeof logout;
    githubLogin: typeof githubLogin;
    githubCallback: typeof githubCallback;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map