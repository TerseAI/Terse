import { TopMenuBar } from "../components/TopMenuBar";
import { Dashboard } from "../components/Dashboard";
import { useIntegrations } from "../context/Integrations";

function Home() {
    const {refreshIntegrations } = useIntegrations();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <TopMenuBar />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Dashboard onIntegrationChange={refreshIntegrations} />
            </div>
        </div>
    )
}





export default Home;