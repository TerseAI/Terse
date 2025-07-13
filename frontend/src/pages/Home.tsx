import { TopMenuBar } from "../components/TopMenuBar";
import { Dashboard } from "../components/Dashboard";
import { LoadingDashboard } from "../components/LoadingDashboard";
import { useIntegrations } from "../context/Integrations";
// import { ChatInterface } from "../components/chat/ChatInterface";

function Home() {
    const { isLoading, refreshIntegrations } = useIntegrations();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <TopMenuBar />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading ? (
                    <LoadingDashboard />
                ) : (
                    <Dashboard onIntegrationChange={refreshIntegrations} />
                )}
            </div>
        </div>
    )
}





export default Home;