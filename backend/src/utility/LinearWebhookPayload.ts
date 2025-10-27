export interface LinearWebhookPayload {
  action: "create" | "update" | "remove";
  actor: {
    id: string;
    name: string;
    email: string;
    url: string;
    type: string;
  };
  createdAt: string;
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    number: number;
    title: string;
    priority: number;
    sortOrder: number;
    prioritySortOrder: number;
    slaType: string;
    addedToTeamAt: string;
    trashed: boolean;
    labelIds: string[];
    teamId: string;
    previousIdentifiers: string[];
    stateId: string;
    reactionData: any[];
    priorityLabel: string;
    botActor?: string;
    identifier: string;
    url: string;
    subscriberIds: string[];
    state: {
      id: string;
      color: string;
      name: string;
      type: string;
    };
    team: {
      id: string;
      key: string;
      name: string;
    };
    labels: any[];
    description?: string;
    descriptionData?: string;
    assignee?: {
      id: string;
      name: string;
      // ... other assignee fields
    };
    // Add other fields as needed
  };
  type: "Issue" | "Comment" | "Project" | string;
  organizationId: string;
  webhookTimestamp: number;
  webhookId: string;
}
