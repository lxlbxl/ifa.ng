import React, { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import { Loader2 } from "lucide-react";
import AgoraVideoRoom from "@/components/AgoraVideoRoom";

const SessionJoinPage = () => {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const { data: session, isLoading, error } = useSessionById(sessionId || "");
  const [token, setToken] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Validate user access
  if (!isLoading && session && user) {
    if (user.id !== session.user_id && user.id !== session.babalawo_id) {
      return <Navigate to="/" replace />;
    }
  }

  useEffect(() => {
    const fetchToken = async () => {
      if (!sessionId || !user) return;
      setLoadingToken(true);
      try {
        const response = await fetch("/api/generateAgoraToken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userId: user.id }),
        });
        const data = await response.json();
        if (response.ok) {
          setToken(data.token);
          setAppId(data.appId);
          setTokenError(null);
        } else {
          setTokenError(data.error || "Failed to get Agora token");
        }
      } catch (err) {
        setTokenError("Failed to get Agora token");
      } finally {
        setLoadingToken(false);
      }
    };

    fetchToken();
  }, [sessionId, user]);

  if (isLoading || loadingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !session || !sessionId) {
    return <div className="text-center mt-8 text-red-600">Session not found or you do not have access.</div>;
  }

  if (tokenError) {
    return <div className="text-center mt-8 text-red-600">Error: {tokenError}</div>;
  }

  const handleLeave = () => {
    window.location.href = "/dashboard";
  };

  if (!token || !appId) {
    return <div className="text-center mt-8">Loading Agora session...</div>;
  }

  return <AgoraVideoRoom sessionId={sessionId} token={token} appId={appId} onLeave={handleLeave} />;
};

export default SessionJoinPage;
