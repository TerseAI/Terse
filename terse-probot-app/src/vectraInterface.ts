import axios from "axios";
import { Jwt } from "./utility/Jwt.js";

const backendBaseUrl = process.env.TERSE_BACKEND_URL || 'http://localhost:3001';

export type Commit = {
    sha: string;
    name: string;
    fileDiffs: FileDiff[];
}
export type FileDiff = {
    filename: string;
    diff: string;
}
export type Repository = {
    name: string;
    owner: string;
    id: number;
}
interface VectraInterface {
    githubAppInstallationCallback(name: string, email: string, username: string, installationId: number, accountName: string | null, repositories: Repository[]): Promise<void>;
    githubAppInstallationDeleted(username: string, installationId: number): Promise<void>;
    githubUnifiedEvent(username: string, installationId: number, repositoryName: string, eventType: string, eventData: any): Promise<void>;
}

export const VectraInterface: VectraInterface = {
    async githubAppInstallationCallback(name: string, email: string, username: string, installationId: number, accountName: string | null, repositories: Repository[]): Promise<void> {
        const token = await new Jwt().sign(username);
        return axios.post(`${backendBaseUrl}/github/installation-callback`, {
            name,
            email,
            username,
            installationId,
            accountName,
            repositories
        }, { 
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            return response.data;
        })
        .catch(error => {
            console.error('GitHub installation callback failed:', error);
            throw error;
        });
    },

    async githubAppInstallationDeleted(username: string, installationId: number): Promise<void> {
        const token = await new Jwt().sign(username);
        return axios.post(`${backendBaseUrl}/github/installation-deleted`, {
            username,
            installationId,
        }, { 
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    },

    async githubUnifiedEvent(username: string, installationId: number, repositoryName: string, eventType: string, eventData: any): Promise<void> {
        const token = await new Jwt().sign(username);
        return axios.post(`${backendBaseUrl}/github/unified-event`, {
            username,
            installationId,
            repositoryName,
            eventType,
            ...eventData
        }, { 
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }
}