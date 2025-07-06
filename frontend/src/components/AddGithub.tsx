import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";

export function AddGithub() {
    const [repositoryName, setRepositoryName] = useState<string | null>(null);

    useEffect(() => {
        BackendProvider.getCurrentGithubIntegration().then(({ repositoryName }) => {
            setRepositoryName(repositoryName);
        });
    }, []);

    return (
        <>
            {repositoryName ? (
                <GithubIntegration repositoryName={repositoryName} />
            ) : (
                <AddGithubIntegration />
            )}
        </>
    )
}

function GithubIntegration({ repositoryName }: { repositoryName: string }) {
    return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">GitHub Repository</h3>
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Connected</span>
                </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Repository: {repositoryName}</p>
            <p className="text-xs text-gray-500">Your GitHub integration is active</p>
        </div>
    )
}

function AddGithubIntegration() {
    return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">GitHub Repository</h3>
            <p className="text-xs text-gray-500 mb-3">Connect your GitHub repository to track issues and pull requests</p>
            <button
                onClick={() => {
                    BackendProvider.requestGitHubAppInstallationUrl().then(({ installationUrl }) => {
                        console.log('installationUrl', installationUrl);
                        window.open(installationUrl, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
                    });
                }}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
                Install GitHub App
            </button>
        </div>
    )
}