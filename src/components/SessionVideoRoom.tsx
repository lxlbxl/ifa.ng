
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import { Loader2 } from "lucide-react";
import AgoraVideoRoom from "./AgoraVideoRoom";

const SessionVideoRoom = () => {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const { data: session, isLoading, error } = useSessionById(sessionId || "");

  console.log("[SessionVideoRoom] user.id:", user?.id);
  console.log("[SessionVideoRoom] session.user_id:", session?.user_id);
  console.log("[SessionVideoRoom] session.babalawo_id:", session?.babalawo_id);

  // Only allow the session user or babalawo to join
  if (!isLoading && session && user) {
    if (user.id !== session.user_id && user.id !== session.babalawo_id) {
      return <Navigate to="/" replace />;
    }
  }

  if (isLoading) {
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

  return <AgoraVideoRoom sessionId={sessionId} onLeave={handleLeave} />;
};

export default SessionVideoRoom;
