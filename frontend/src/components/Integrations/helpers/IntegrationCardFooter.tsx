import { CardFooter } from "../../ui/card";
import { Button } from "../../ui/button";

interface IntegrationCardFooterProps {
    connect?: () => void;
    isConnecting?: boolean;
    buttonText?: string;
}

export function IntegrationCardFooter({ connect, isConnecting = false, buttonText = "Manage Connection" }: IntegrationCardFooterProps) {
    return (
        <CardFooter>
            <Button 
                variant="outline" 
                disabled={isConnecting || !connect}
                onClick={connect || undefined}
            >
                {buttonText}
            </Button>
        </CardFooter>
    );
}

