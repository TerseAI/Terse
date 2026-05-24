import { LinearClient } from "@linear/sdk"
import { LinearOrganization, Team, TicketSystemUser, UserContext } from "terse-types/TicketSystem"

export class LinearAdapter {
    private client: LinearClient

    constructor(apiKey: string) {
        this.client = new LinearClient({ apiKey })
    }

    async getUserContext(): Promise<UserContext> {
        const viewer = await this.client.viewer
        const organization = await this.client.organization
        const teams = await viewer.teams()

        const user: TicketSystemUser = {
            id: viewer.id,
            name: viewer.name,
            email: viewer.email
        }

        const teamsList: Team[] = teams.nodes.map(team => ({
            id: team.id,
            name: team.name,
            key: team.key
        }))

        const projects = await this.client.projects()

        const org: LinearOrganization = {
            id: organization.id,
            name: organization.name,
            createdAt: organization.createdAt.toISOString(),
            createdIssueCount: organization.createdIssueCount,
            userCount: organization.userCount,
            projects: projects.nodes.map(project => ({
                id: project.id,
                name: project.name,
                description: project.description || undefined,
                updates: []
            }))
        }

        const ticketStates = await this.client.workflowStates()

        const milestones = await this.client.projectMilestones()

        return {
            userInfo: user,
            teams: teamsList,
            organization: org,
            ticketStates: ticketStates.nodes.map(state => ({
                id: state.id,
                name: state.name
            })),
            milestones: milestones.nodes.map(milestone => ({
                id: milestone.id,
                name: milestone.name
            }))
        }
    }

    async getTeams(): Promise<Team[]> {
        const teams = await this.client.teams()
        return teams.nodes.map(team => ({
            id: team.id,
            name: team.name,
            key: team.key
        }))
    }

    async userIdFromEmail(email: string): Promise<string | null> {
        const user = await this.client.users({
            filter: {
                email: { eq: email }
            }
        })
        if (!user) {
            return null
        }
        return user.nodes[0].id
    }

    async getStates(teamId?: string): Promise<
        Array<{
            id: string
            name: string
            type: string
            color: string
            teamId: string
        }>
    > {
        const states = teamId ? await this.client.team(teamId).then(team => team?.states()) : await this.client.workflowStates()

        if (!states) return []

        const statesWithTeams = await Promise.all(
            states.nodes.map(async state => {
                const team = await state.team
                return {
                    id: state.id,
                    name: state.name,
                    type: state.type,
                    color: state.color,
                    teamId: team?.id || ""
                }
            })
        )

        return statesWithTeams
    }

    async getLabels(teamId?: string): Promise<Array<{ id: string; name: string; color: string; teamId: string }>> {
        const labels = teamId ? await this.client.team(teamId).then(team => team?.labels()) : await this.client.issueLabels()

        if (!labels) return []

        const labelsWithTeams = await Promise.all(
            labels.nodes.map(async label => {
                const team = await label.team
                return {
                    id: label.id,
                    name: label.name,
                    color: label.color,
                    teamId: team?.id || ""
                }
            })
        )

        return labelsWithTeams
    }

    async getProjects(teamId?: string): Promise<Array<{ id: string; name: string; description?: string; teamId: string }>> {
        const projects = teamId ? await this.client.team(teamId).then(team => team?.projects()) : await this.client.projects()

        if (!projects) return []

        const projectsWithTeams = await Promise.all(
            projects.nodes.map(async project => {
                const teams = await project.teams()
                const teamId = teams.nodes[0]?.id || ""
                return {
                    id: project.id,
                    name: project.name,
                    description: project.description || undefined,
                    teamId
                }
            })
        )

        return projectsWithTeams
    }

    async getUsers(): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string }>> {
        const users = await this.client.users()
        return users.nodes.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl || undefined
        }))
    }
}
