import { IntegrationType } from "./Integrations.js";
export type ApprovalActionType = "open_run_history" | "approve_action" | "reject_action";
export type ApprovalRequestStatus = "pending" | "in_progress" | "completed";
export type ApprovalRequestFilter = ApprovalRequestStatus | "all";
export type ApprovalAction = {
    type: ApprovalActionType;
    label: string;
    deepLink: string;
};
export type ApprovalRequest = {
    id: string;
    icon: IntegrationType;
    title: string;
    subheader: string;
    timestamp: string;
    status: ApprovalRequestStatus;
    actions: ApprovalAction[];
    runId: string;
    agentId: string;
};
export type GetPendingApprovalsResponse = {
    items: ApprovalRequest[];
};
export declare function parseDeepLink(deepLink: string): {
    type: string;
    params: string[];
};
export declare function encodeDeepLink(type: ApprovalActionType, ...params: string[]): string;
