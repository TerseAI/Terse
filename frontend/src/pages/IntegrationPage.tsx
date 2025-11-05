import { useIntegrations, IntegrationProvider, Integration } from "@/context/Integrations";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function IntegrationPage() {
    const { integrations } = useIntegrations();
    return (
        <IntegrationProvider>
            <div>
                <h1>Integration</h1>
                <div>
                    <h2>Integrations</h2>
                    <ul>
                        {integrations.map((integration) => (
                            <IntegrationCard key={integration} integration={integration} />
                        ))}
                    </ul>
                </div>
            </div>
        </IntegrationProvider>
    )
}

function IntegrationCard({ integration }: { integration: Integration }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{integration}</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Integration details</p>
            </CardContent>
            <CardFooter>
                <CardAction>
                    <Button>Connect</Button>
                </CardAction>
            </CardFooter>
        </Card>
    )
}

export default IntegrationPage;