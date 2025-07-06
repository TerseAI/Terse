import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import Spin from "./Spin";

export function AddToSlack() {
    const [teamName, setTeamName] = useState<string | null>(null);

    useEffect(() => {
        BackendProvider.getCurrentSlackIntegration().then(({ teamName }) => {
            setTeamName(teamName);
        });
    }, []);

    return (
        <>
            {teamName ? (
                <SlackIntegration teamName={teamName} />
            ) : (
                <AddSlackIntegration />
            )}
        </>
    );
}

function SlackIntegration({ teamName }: { teamName: string }) {
    return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">Slack Workspace</h3>
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Connected</span>
                </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Team: {teamName}</p>
            <p className="text-xs text-gray-500">Your Slack integration is active</p>
        </div>
    )
}

function AddSlackIntegration() {
    const [slackOAuthUrl, setSlackOAuthUrl] = useState<string | null>(null);

    useEffect(() => {
        BackendProvider.requestSlackOAuthUrl().then(({ url }) => {
            setSlackOAuthUrl(url);
        });
    }, []);

    if (!slackOAuthUrl) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Slack Workspace</h3>
                <div className="flex items-center justify-center py-4">
                    <Spin />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Slack Workspace</h3>
            <p className="text-xs text-gray-500 mb-3">Connect your Slack workspace to receive notifications</p>
            <a
                href={slackOAuthUrl}
                className="inline-flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-white bg-[#4A154B] rounded-md hover:bg-[#3a0f3a] focus:outline-none focus:ring-2 focus:ring-[#4A154B] focus:ring-offset-2 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    viewBox="0 0 122.8 122.8"
                >
                    <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
                    <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
                    <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
                    <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
                </svg>
                Add to Slack
            </a>
        </div>
    );
}