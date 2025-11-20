import { CardFooter } from "../../ui/card";
import { Button } from "../../ui/button";

interface IntegrationCardFooterProps {
    connect?: () => void;
    isConnecting?: boolean;
}

export function IntegrationCardFooter({ connect, isConnecting = false }: IntegrationCardFooterProps) {
    return (
        <CardFooter>
            <Button 
                variant="outline" 
                disabled={isConnecting || !connect}
                onClick={connect || undefined}
            >
                Manage Connection
            </Button>
        </CardFooter>
    );
}

