import { CardFooter } from "../../ui/card";
import { Button } from "../../ui/button";

interface IntegrationCardFooterProps {
    oauthUrl: string | null;
}

export function IntegrationCardFooter({ oauthUrl }: IntegrationTypeCardFooterProps) {
    return (
        <CardFooter>
            <Button 
                variant="outline" 
                disabled={!oauthUrl}
                onClick={() => {
                    if (oauthUrl) {
                        window.open(oauthUrl, 'oauth-popup', 'width=600,height=700');
                    }
                }}
            >
                Manage Connection
            </Button>
        </CardFooter>
    );
}

