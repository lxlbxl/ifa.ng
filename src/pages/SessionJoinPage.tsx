import React from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SessionVideoRoom from "@/components/SessionVideoRoom";

const SessionJoinPage = () => {
  const { sessionId } = useParams();

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Session ID is missing. Cannot join the session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SessionVideoRoom />
    </div>
  );
};

export default SessionJoinPage;
