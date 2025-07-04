import { Request, Response } from "express";

const GITHUB_APP_CLIENT_ID = process.env.GITHUB_CLIENT_ID

// Get GitHub App installation URL
export async function getInstallationUrl(req: Request, res: Response) {
    try {
        // Generate GitHub App installation URL with callback
        const installationUrl = `https://github.com/apps/vectra-github/installations/new?client_id=${GITHUB_APP_CLIENT_ID}&state=vectra&target_type=repositories`;
        
        res.json({ 
            installationUrl
        });
    } catch (error) {
        console.error('Error generating installation URL:', error);
        res.status(500).json({ message: 'Failed to generate installation URL' });
    }
}

export default { 
    getInstallationUrl
}; 