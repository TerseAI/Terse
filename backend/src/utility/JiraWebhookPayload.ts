// Based on official Jira webhook documentation
// https://developer.atlassian.com/server/jira/platform/webhooks/

export interface JiraWebhookPayload {
    timestamp: number
    webhookEvent: string // e.g., "jira:issue_created", "jira:issue_updated", "comment_created"
    issue_event_type_name?: string
    user: {
        self: string
        name: string
        key: string
        accountId?: string
        emailAddress: string
        avatarUrls: {
            "48x48": string
            "24x24": string
            "16x16": string
            "32x32": string
        }
        displayName: string
        active: boolean
        timeZone?: string
        locale?: string
    }
    issue: {
        id: string
        self: string
        key: string
        fields: {
            statuscategorychangedate: string
            issuetype: {
                self: string
                id: string
                description: string
                iconUrl: string
                name: string
                subtask: boolean
                avatarId?: number
            }
            timespent?: number
            project: {
                self: string
                id: string
                key: string
                name: string
                projectTypeKey: string
                simplified: boolean
                avatarUrls: {
                    "48x48": string
                    "24x24": string
                    "16x16": string
                    "32x32": string
                }
            }
            fixVersions: Array<{
                self: string
                id: string
                description?: string
                name: string
                archived: boolean
                released: boolean
                startDate?: string
                releaseDate?: string
                userStartDate?: string
                userReleaseDate?: string
                projectId: number
            }>
            aggregatetimespent?: number
            resolution?: {
                self: string
                id: string
                description: string
                name: string
            }
            resolutiondate?: string
            workratio: number
            lastViewed?: string
            watches: {
                self: string
                watchCount: number
                isWatching: boolean
            }
            created: string
            priority: {
                self: string
                iconUrl: string
                name: string
                id: string
            }
            labels: string[]
            timeestimate?: number
            aggregatetimeoriginalestimate?: number
            versions: Array<{
                self: string
                id: string
                name: string
                description?: string
                archived: boolean
                released: boolean
                startDate?: string
                releaseDate?: string
                userStartDate?: string
                userReleaseDate?: string
                projectId: number
            }>
            issuelinks: Array<{
                id: string
                self: string
                type: {
                    id: string
                    name: string
                    inward: string
                    outward: string
                    self: string
                }
                outwardIssue?: {
                    id: string
                    key: string
                    self: string
                    fields: {
                        summary: string
                        status: {
                            self: string
                            description: string
                            iconUrl: string
                            name: string
                            id: string
                            statusCategory: {
                                self: string
                                id: number
                                key: string
                                colorName: string
                                name: string
                            }
                        }
                        priority: {
                            self: string
                            iconUrl: string
                            name: string
                            id: string
                        }
                        issuetype: {
                            self: string
                            id: string
                            description: string
                            iconUrl: string
                            name: string
                            subtask: boolean
                            avatarId?: number
                        }
                    }
                }
                inwardIssue?: {
                    id: string
                    key: string
                    self: string
                    fields: {
                        summary: string
                        status: {
                            self: string
                            description: string
                            iconUrl: string
                            name: string
                            id: string
                            statusCategory: {
                                self: string
                                id: number
                                key: string
                                colorName: string
                                name: string
                            }
                        }
                        priority: {
                            self: string
                            iconUrl: string
                            name: string
                            id: string
                        }
                        issuetype: {
                            self: string
                            id: string
                            description: string
                            iconUrl: string
                            name: string
                            subtask: boolean
                            avatarId?: number
                        }
                    }
                }
            }>
            assignee?: {
                self: string
                name: string
                key: string
                accountId?: string
                emailAddress: string
                avatarUrls: {
                    "48x48": string
                    "24x24": string
                    "16x16": string
                    "32x32": string
                }
                displayName: string
                active: boolean
                timeZone?: string
                locale?: string
            } | null
            updated: string
            status: {
                self: string
                description: string
                iconUrl: string
                name: string
                id: string
                statusCategory: {
                    self: string
                    id: number
                    key: string
                    colorName: string
                    name: string
                }
            }
            components: Array<{
                self: string
                id: string
                name: string
                description?: string
                lead?: {
                    self: string
                    name: string
                    key: string
                    accountId?: string
                    emailAddress: string
                    avatarUrls: {
                        "48x48": string
                        "24x24": string
                        "16x16": string
                        "32x32": string
                    }
                    displayName: string
                    active: boolean
                    timeZone?: string
                    locale?: string
                }
                assigneeType: string
                assignee?: {
                    self: string
                    name: string
                    key: string
                    accountId?: string
                    emailAddress: string
                    avatarUrls: {
                        "48x48": string
                        "24x24": string
                        "16x16": string
                        "32x32": string
                    }
                    displayName: string
                    active: boolean
                    timeZone?: string
                    locale?: string
                }
                realAssigneeType: string
                realAssignee?: {
                    self: string
                    name: string
                    key: string
                    accountId?: string
                    emailAddress: string
                    avatarUrls: {
                        "48x48": string
                        "24x24": string
                        "16x16": string
                        "32x32": string
                    }
                    displayName: string
                    active: boolean
                    timeZone?: string
                    locale?: string
                }
                isAssigneeTypeValid: boolean
                project: string
                projectId: number
            }>
            timeoriginalestimate?: number
            description?: string
            timetracking: {
                originalEstimate?: string
                remainingEstimate?: string
                timeSpent?: string
                originalEstimateSeconds?: number
                remainingEstimateSeconds?: number
                timeSpentSeconds?: number
            }
            security?: {
                self: string
                id: string
                description: string
                name: string
            }
            attachment: Array<{
                self: string
                id: string
                filename: string
                author: {
                    self: string
                    name: string
                    key: string
                    accountId?: string
                    emailAddress: string
                    avatarUrls: {
                        "48x48": string
                        "24x24": string
                        "16x16": string
                        "32x32": string
                    }
                    displayName: string
                    active: boolean
                    timeZone?: string
                    locale?: string
                }
                created: string
                size: number
                mimeType: string
                content: string
                thumbnail?: string
            }>
            aggregatetimeestimate?: number
            summary: string
            creator: {
                self: string
                name: string
                key: string
                accountId?: string
                emailAddress: string
                avatarUrls: {
                    "48x48": string
                    "24x24": string
                    "16x16": string
                    "32x32": string
                }
                displayName: string
                active: boolean
                timeZone?: string
                locale?: string
            }
            subtasks: Array<{
                id: string
                key: string
                self: string
                fields: {
                    summary: string
                    status: {
                        self: string
                        description: string
                        iconUrl: string
                        name: string
                        id: string
                        statusCategory: {
                            self: string
                            id: number
                            key: string
                            colorName: string
                            name: string
                        }
                    }
                    priority: {
                        self: string
                        iconUrl: string
                        name: string
                        id: string
                    }
                    issuetype: {
                        self: string
                        id: string
                        description: string
                        iconUrl: string
                        name: string
                        subtask: boolean
                        avatarId?: number
                    }
                }
            }>
            reporter: {
                self: string
                name: string
                key: string
                accountId?: string
                emailAddress: string
                avatarUrls: {
                    "48x48": string
                    "24x24": string
                    "16x16": string
                    "32x32": string
                }
                displayName: string
                active: boolean
                timeZone?: string
                locale?: string
            }
            aggregateprogress: {
                progress: number
                total: number
                percent?: number
            }
            environment?: string
            duedate?: string
            progress: {
                progress: number
                total: number
                percent?: number
            }
            votes: {
                self: string
                votes: number
                hasVoted: boolean
            }
        }
    }
    changelog?: {
        id: string
        items: Array<{
            field: string
            fieldtype: string
            fieldId?: string
            from?: string
            fromString?: string
            to?: string
            toString?: string
        }>
    }
    comment?: {
        self: string
        id: string
        author: {
            self: string
            name: string
            key: string
            accountId?: string
            emailAddress: string
            avatarUrls: {
                "48x48": string
                "24x24": string
                "16x16": string
                "32x32": string
            }
            displayName: string
            active: boolean
            timeZone?: string
            locale?: string
        }
        body: string
        updateAuthor: {
            self: string
            name: string
            key: string
            accountId?: string
            emailAddress: string
            avatarUrls: {
                "48x48": string
                "24x24": string
                "16x16": string
                "32x32": string
            }
            displayName: string
            active: boolean
            timeZone?: string
            locale?: string
        }
        created: string
        updated: string
        visibility?: {
            type: string
            value: string
        }
    }
}

export type JiraWebhookEvent = "Issue" | "Comment" | "Project"
