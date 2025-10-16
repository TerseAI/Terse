import { Input } from "../../../context/AutomationContext";
import { Integration } from "../../../context/Integrations";

export function IntegrationInput({ input }: { input: Input }) {
    return (
        <IntegrationBox>
            <IconForInputType type={input.integration} />
        </IntegrationBox>
    )
}

export function IntegrationBox({children}: {children: React.ReactNode}) {
    return (
        <div
            className="w-18 h-18 border-2 border-[theme(text-primary)] border-solid flex items-center justify-center p-3"
        >
            {children}
        </div>
    )
}

function IconForInputType({ type }: { type: Integration }) {
    switch (type) {
        case Integration.GITHUB:
            return <GithubIcon />;
        case Integration.LINEAR:
            return <LinearIcon />;
        case Integration.SLACK:
            return <SlackIcon />;
        case Integration.NOTION:
            return <NotionIcon />;
        case Integration.JIRA:
            return <JiraIcon />;
    }
}

function GithubIcon() {
    return <img src="/setup-github.png" alt="GitHub" className="w-full h-full object-contain" />;
}

function LinearIcon() {
    return <img src="/linear.png" alt="Linear" className="w-full h-full object-contain" />;
}

function SlackIcon() {
    return <img src="/Slack.png" alt="Slack" className="w-full h-full object-contain" />;
}

function NotionIcon() {
    return <img src="/notion.png" alt="Notion" className="w-full h-full object-contain" />;
}

function JiraIcon() {
    return <img src="/jira.png" alt="Jira" className="w-full h-full object-contain" />;
}