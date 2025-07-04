import axios from "axios";
import { Jwt } from "./utility/Jwt.js";

const backendBaseUrl = process.env.VECTRA_BACKEND_URL || 'http://localhost:3001';

interface VectraInterface {
    githubAppInstallationCallback(name: string, email: string, username: string, installationId: number, repositoryName: string): Promise<void>;
    githubAppInstallationDeleted(username: string, installationId: number): Promise<void>;
}

export const VectraInterface: VectraInterface = {
    async githubAppInstallationCallback(name: string, email: string, username: string, installationId: number, repositoryName: string): Promise<void> {

        console.log('githubAppInstallationCallback', username, installationId, repositoryName);

        // Get JWT token first
        const token = await new Jwt().sign(username);

        return axios.post(`${backendBaseUrl}/github/installation-callback`, {
            name,
            email,
            username,
            installationId,
            repositoryName
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
    }
}