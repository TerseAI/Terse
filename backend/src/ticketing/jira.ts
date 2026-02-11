import chalk from "chalk"
import JiraClient from "jira-client"

import { urls } from "../config/settings"
import { SearchItem } from "../search/SearchItem"
import { ApiRoutes } from "../shared/ApiRoutes"
import { CommitAssociation, CreateTicketInput, Organization, Project, Team, Ticket, TicketSystemType, UpdateTicketInput, User, UserContext } from "../shared/TicketSystem"
import { generateWebhookSecret } from "../utility/webhookSecrets"

import { StructuredSearchOptions } from "./StructuredSearchOptions"

// Atlassian Document Format (ADF) interfaces
interface ADFText {
    type: "text"
    text: string
    marks?: Array<{ type: string; attrs?: Record<string, any> }>
}

interface ADFParagraph {
    type: "paragraph"
    content: ADFText[]
}

interface ADFDocument {
    version: 1
    type: "doc"
    content: ADFParagraph[]
}

// Helper function to convert plain text to Atlassian Document Format
function textToADF(text: string): ADFDocument {
    return {
        version: 1,
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: [
                    {
                        type: "text",
                        text: text
                    }
                ]
            }
        ]
    }
}

export class JiraAdapter {
    type: TicketSystemType = TicketSystemType.Jira

    private client: JiraClient

    constructor(options: { baseUrl: string; email: string; apiToken: string }) {
        this.client = new JiraClient({
            host: options.baseUrl.replace(/^https?:\/\//, ""),
            protocol: options.baseUrl.startsWith("https") ? "https" : "http",
            username: options.email,
            password: options.apiToken,
            apiVersion: "3"
        })
    }

    static async validateCredentials(baseUrl: string, email: string, apiToken: string): Promise<boolean> {
        try {
            const client = new JiraClient({
                host: baseUrl.replace(/^https?:\/\//, ""),
                protocol: baseUrl.startsWith("https") ? "https" : "http",
                username: email,
                password: apiToken,
                apiVersion: "3"
            })
            await client.getCurrentUser()
            return true
        } catch (error) {
            console.error(chalk.red("Invalid Jira credentials"), chalk.yellow(baseUrl), chalk.yellow(email), chalk.yellow(apiToken))
            console.error(error)
            return false
        }
    }

    async getUserContext(): Promise<UserContext> {
        const me = await this.client.getCurrentUser()
        const projects = await this.client.listProjects()

        const user: User = {
            id: me.accountId,
            name: me.displayName,
            email: me.emailAddress
        }

        const teams: Team[] = projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            key: p.key
        }))

        const org: Organization = {
            id: "",
            name: "",
            createdAt: "",
            createdIssueCount: 0,
            userCount: 0,
            projects: projects.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                updates: []
            }))
        }

        // Default common Jira statuses - fetching transitions requires a specific issue
        const defaultStates = [
            { id: "11", name: "To Do" },
            { id: "31", name: "In Progress" },
            { id: "21", name: "Done" }
        ]

        const context: UserContext = {
            userInfo: user,
            teams,
            organization: org,
            ticketStates: defaultStates,
            milestones: []
        }

        return context
    }

    async findTicket(id: string): Promise<Ticket> {
        const issue = await this.client.findIssue(id)
        return this.convertIssue(issue)
    }

    async getTickets(ids: string[]): Promise<Ticket[]> {
        const issues = await this.client.searchJira(`id in (${ids.join(",")})`)
        return issues.issues.map((i: any) => this.convertIssue(i))
    }

    async structuredSearch(jql: string, _options?: StructuredSearchOptions): Promise<Ticket[]> {
        const res = await this.client.searchJira(jql)
        return res.issues.map((i: any) => this.convertIssue(i))
    }

    async userIdFromEmail(email: string): Promise<string | null> {
        const users = await this.client.searchUsers({
            query: email
        })
        return users.length > 0 ? users[0].accountId : null
    }

    async createTicket(input: CreateTicketInput): Promise<Ticket> {
        console.log("🔧 Creating ticket via Jira", input)

        // Determine issue type - default to Task if not specified
        const issueType = input.issueType || "Task"

        const issue = await this.client.addNewIssue({
            fields: {
                summary: input.title,
                description: input.description ? textToADF(input.description) : undefined,
                project: { key: input.project?.id },
                issuetype: { name: issueType },
                assignee: input.assignee ? { id: await this.userIdFromEmail(input.assignee) } : undefined
            }
        })
        return this.findTicket(issue.key)
    }

    async updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
        const updateFields: Record<string, any> = {
            summary: input.title
        }

        if (input.description) {
            updateFields.description = textToADF(input.description)
        }

        if (input.assignee) {
            const userId = await this.userIdFromEmail(input.assignee)
            if (userId) {
                updateFields.assignee = { accountId: userId } // 🔧 use accountId, not id
            }
        }

        try {
            // First, update the editable fields
            await this.client.updateIssue(id, {
                fields: updateFields
            })

            // Then, if there's a state transition, do it separately
            if (input.state) {
                await this.client.transitionIssue(id, {
                    transition: { id: input.state.id }
                })
            }
        } catch (error) {
            console.error("🔧 Error updating ticket", error)
            throw error
        }

        return this.findTicket(id)
    }

    async commentOnTicket(id: string, comment: string): Promise<void> {
        await this.client.addComment(id, comment)
        console.log(chalk.green("✅ Comment added:"), chalk.cyan(comment))
    }

    async deleteComment(ticketId: string, commentId: string): Promise<void> {
        await this.client.deleteComment(ticketId, parseInt(commentId))
    }

    async searchItemsForTicket(id: string): Promise<SearchItem[]> {
        console.log("🔧 Searching for items for ticket:", id)
        const issue = await this.client.findIssue(id)
        console.log("🔧 Issue to be indexed:", issue)
        return [
            {
                id: issue.id,
                teamId: issue.fields.project.id,
                entityType: "ticket",
                entityId: issue.id,
                content: issue.fields.summary,
                metadata: {}
            },
            {
                id: `${issue.id}-desc`,
                teamId: issue.fields.project.id,
                entityType: "ticket",
                entityId: issue.id,
                content: issue.fields.description || "",
                metadata: {}
            }
        ]
    }

    async isTicketComplete(ticketId: string): Promise<boolean> {
        const ticket = await this.findTicket(ticketId)
        return ticket.state.name === "Done"
    }

    async searchItemsForProject(id: string): Promise<SearchItem[]> {
        return []
    }

    async getTeams(): Promise<Team[]> {
        const projects = await this.client.listProjects()
        return projects.map((p: any) => ({ id: p.id, name: p.name, key: p.key }))
    }

    async me(): Promise<User | null> {
        const me = await this.client.getCurrentUser()
        return me ? { id: me.accountId, name: me.displayName, email: me.emailAddress } : null
    }

    async getAllTickets(): Promise<Ticket[]> {
        const res = await this.client.searchJira("")
        return res.issues.map((i: any) => this.convertIssue(i))
    }

    async getAllProjects(): Promise<Project[]> {
        const projects = await this.client.listProjects()
        return projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            updates: []
        }))
    }

    async tearDownWebhook(webhookId: string): Promise<void> {
        await this.client.deleteWebhook(webhookId)
        console.log(chalk.green("✅ Webhook deleted:"), chalk.cyan(webhookId))
    }

    async configureWebhook(): Promise<{
        webhookId: string
        webhookSecret: string
    } | null> {
        const user = await this.client.getCurrentUser()
        if (!user) {
            console.error(chalk.red("❌ No user found"))
            return null
        }

        const webhookSecret = this.generateWebhookSecret()
        const backendUrl = urls.backend

        const webhook = await this.client.registerWebhook({
            name: "Vectra AI",
            url: `${backendUrl}${ApiRoutes.WEBHOOKS.JIRA_BY_ACCOUNT_ID.build(user.accountId)}`,
            secret: webhookSecret,
            events: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"]
        })
        console.log("🔧 Webhook created:", webhook)

        // Extract webhook ID from the self URL
        const webhookId = webhook.self.split("/").pop()
        console.log("🔧 Extracted webhook ID:", webhookId)

        return { webhookId: webhookId, webhookSecret: webhook.secret }
    }

    generateWebhookSecret() {
        // Generate 32 random bytes and convert to hex
        // Using utility function for consistency
        return generateWebhookSecret(32)
    }

    async getIssueTypes(projectKey?: string): Promise<Array<{ id: string; name: string; description?: string }>> {
        try {
            // For now, return common Jira issue types
            // In a full implementation, you'd fetch these from the Jira API
            const commonIssueTypes = [
                {
                    id: "10000",
                    name: "Task",
                    description: "A task that needs to be done"
                },
                {
                    id: "10001",
                    name: "Bug",
                    description: "A problem which impairs or prevents the functions of the product"
                },
                { id: "10002", name: "Story", description: "A user story" },
                {
                    id: "10003",
                    name: "Epic",
                    description: "A big user story that needs to be broken down"
                },
                {
                    id: "10004",
                    name: "Subtask",
                    description: "A sub-task of the parent issue"
                },
                {
                    id: "10005",
                    name: "Improvement",
                    description: "An improvement or enhancement to an existing feature"
                },
                {
                    id: "10006",
                    name: "New Feature",
                    description: "A new feature of the product"
                }
            ]

            return commonIssueTypes
        } catch (error) {
            console.error("Error getting issue types:", error)
            return []
        }
    }

    async associateCommitsToTicket(ticketId: string, commits: CommitAssociation[], branchName: string): Promise<void> {
        // Get existing comments to avoid duplicates
        const comments = await this.client.getComments(ticketId)

        for (const commit of commits) {
            // Check if commit is already mentioned in comments
            const existing = comments.comments.find((c: any) => c.body.includes(commit.sha.substring(0, 8)))
            if (existing) {
                console.log(`Commit ${commit.sha} already associated with ${ticketId}`)
                continue
            }

            // Create comment for the commit
            const comment =
                `🔗 **Commit**: ${commit.sha.substring(0, 8)}\n` +
                `📝 **Message**: ${commit.message}\n` +
                `🌿 **Branch**: ${commit.branch || "main"}\n` +
                `📦 **Repository**: ${commit.repository}\n` +
                `🔗 **Link**: ${commit.url}`

            await this.client.addComment(ticketId, comment)
            console.log(`✅ Associated commit ${commit.sha} with ${ticketId}`)
        }
    }

    private convertIssue(issue: any): Ticket {
        return {
            id: issue.id,
            identifier: issue.key,
            title: issue.fields.summary,
            description: issue.fields.description || undefined,
            state: {
                id: issue.fields.status?.id || "",
                name: issue.fields.status?.name || ""
            },
            assignee: issue.fields.assignee
                ? {
                      id: issue.fields.assignee.accountId,
                      name: issue.fields.assignee.displayName
                  }
                : null,
            priority: issue.fields.priority ? parseInt(issue.fields.priority.id) : undefined,
            labels: (issue.fields.labels || []).map((l: string) => ({
                id: l,
                name: l,
                color: ""
            })),
            estimate: issue.fields.timeoriginalestimate || undefined,
            dueDate: issue.fields.duedate || undefined,
            project: {
                id: issue.fields.project.id,
                name: issue.fields.project.name
            },
            team: {
                id: issue.fields.project.id,
                name: issue.fields.project.name,
                key: issue.fields.project.key
            },
            createdAt: issue.fields.created,
            updatedAt: issue.fields.updated
        }
    }
}
