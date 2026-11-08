
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import AgoraVideoRoom from "./AgoraVideoRoom";
import DailyVideoRoom from "./DailyVideoRoom";
import { getActiveVideoProvider } from "@/services/dailyService";

const SessionVideoRoom = () => {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const { data: session, isLoading, error } = useSessionById(sessionId || "");
  const [videoProvider, setVideoProvider] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);

  console.log("[SessionVideoRoom] user:", user);
  console.log("[SessionVideoRoom] sessionId:", sessionId);
  console.log("[SessionVideoRoom] session:", session);
  console.log("[SessionVideoRoom] isLoading:", isLoading);
  console.log("[SessionVideoRoom] error:", error);
  console.log("[SessionVideoRoom] videoProvider:", videoProvider);
  console.log("[SessionVideoRoom] providerLoading:", providerLoading);

  useEffect(() => {
    const fetchVideoProvider = async () => {
      try {
        const provider = await getActiveVideoProvider();
        setVideoProvider(provider);
      } catch (error) {
        console.error("Error fetching video provider:", error);
        setVideoProvider("agora"); // Default to Agora if error
      } finally {
        setProviderLoading(false);
      }
    };

    fetchVideoProvider();
  }, []);

  // Only allow the session user or babalawo to join
  if (!isLoading && session && user) {
    if (user.id !== session.user_id && user.id !== session.babalawo_id) {
      return <Navigate to="/" replace />;
    }
  }

  if (isLoading || providerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (error || !session || !sessionId) {
    return <div className="text-center mt-8 text-red-600">Session not found or you do not have access.</div>;
  }

  const handleLeave = () => {
    window.location.href = "/dashboard";
  };

  // Render the appropriate video room component based on the active provider
  if (videoProvider === "daily") {
    return <DailyVideoRoom sessionId={sessionId} onLeave={handleLeave} />;
  }

  // Default to Agora
  return <AgoraVideoRoom sessionId={sessionId} onLeave={handleLeave} />;
};

export default SessionVideoRoom;
