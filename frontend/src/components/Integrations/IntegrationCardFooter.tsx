import { CardFooter } from "../ui/card";
import { Button } from "../ui/button";

interface IntegrationCardFooterProps {
    oauthUrl: string | null;
}

export function IntegrationCardFooter({ oauthUrl }: IntegrationCardFooterProps) {
    return (
        <CardFooter>
            <Button 
                variant="outline" 
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

