import { useState } from "react";
import { BackendProvider } from "../../../services/backend";
import { IntegrationCard } from "../IntegrationCard";
import { useIntegrations } from "../../../context/Integrations";
import posthog from "posthog-js";
import { PosthogEvents } from "../../../utility/PosthogEvents";
import { useAuth } from "../../../services/auth";

function AddGmail() {
  const { hasGmail, isPolling, startPolling, refreshIntegrations } = useIntegrations();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await BackendProvider.deleteGmailIntegration();
      posthog.capture(PosthogEvents.USER_DISCONNECTED_GMAIL, {
        email: user?.email || "unknown",
        integration: "gmail",
      });
      await refreshIntegrations();
    } catch (error) {
      console.error("Error disconnecting Gmail:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const connectButton = (
    <button
      onClick={async () => {
        setIsLoading(true);
        try {
          posthog.capture(PosthogEvents.USER_INTEGRATED_GMAIL, {
            email: user?.email || "unknown",
          });
          const { url } = await BackendProvider.requestGmailOAuthUrl();
          window.open(url, "_blank", "width=600,height=700,scrollbars=yes,resizable=yes");
          startPolling();
        } catch (error) {
          console.error("Error requesting Gmail OAuth URL:", error);
        } finally {
          setIsLoading(false);
        }
      }}
      disabled={isLoading || isPolling}
      className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? "Opening Gmail..." : isPolling ? "Checking connection..." : "Connect to Gmail"}
    </button>
  );

  return (
    <IntegrationCard
      title="Gmail"
      description="Connect your Gmail account to ingest emails"
      isConnected={hasGmail}
      isLoading={isLoading || isPolling}
      connectionInfo={isPolling ? "Checking connection..." : hasGmail ? "Connected" : undefined}
      onDisconnect={handleDisconnect}
      disconnectLabel="Disconnect Gmail"
      connectButton={connectButton}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z"
          />
          <path
            fill="#FBBC04"
            d="M0 5.457v.727l12 9 12-9v-.727c0-2.023-2.309-3.178-3.927-1.964L12 9.366 3.927 3.493C2.31 2.28 0 3.434 0 5.457z"
          />
          <path
            fill="#34A853"
            d="M18.545 7.091v13.818h3.819c.904 0 1.636-.732 1.636-1.636V5.457z"
          />
          <path fill="#C5221F" d="M0 19.366c0 .904.732 1.636 1.636 1.636h3.819V7.091z" />
        </svg>
      }
    />
  );
}

export default AddGmail;
