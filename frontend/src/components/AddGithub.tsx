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
        <div>
            <p>Github Integration: {repositoryName}</p>
        </div>
    )
}

function AddGithubIntegration() {
    return (
        <button
            onClick={() => {
                BackendProvider.requestGitHubAppInstallationUrl().then(({ installationUrl }) => {
                    console.log('installationUrl', installationUrl);
                    window.open(installationUrl, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
                });
            }}
        >
            Install GitHub App
        </button>
    )
}