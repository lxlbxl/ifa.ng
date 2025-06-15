
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

const JITSI_DOMAIN = 'meet.jit.si';

const SessionVideoRoom = () => {
  const { user, userProfile } = useAuth();
  const { sessionId } = useParams();
  const { data: session, isLoading, error } = useSessionById(sessionId || "");
  const jitsiRef = useRef<HTMLDivElement>(null);

  // Only allow the session user or babalawo to join
  if (!isLoading && session && user) {
    if (user.id !== session.user_id && user.id !== session.babalawo_id) {
      return <Navigate to="/" replace />;
    }
  }

  useEffect(() => {
    if (!session || !userProfile || !jitsiRef.current) return;

    // @ts-ignore
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => startJitsi();
      document.body.appendChild(script);
    } else {
      startJitsi();
    }

    function startJitsi() {
      // @ts-ignore
      const JitsiMeetExternalAPI = window.JitsiMeetExternalAPI;
      new JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: session.jitsi_room_name || `session-${session.id}`,
        parentNode: jitsiRef.current,
        userInfo: {
          displayName: userProfile.full_name || "Guest",
          email: userProfile.email || ""
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (jitsiRef.current) jitsiRef.current.innerHTML = "";
    };
  }, [session, userProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error || !session) {
    return <div className="text-center mt-8 text-red-600">Session not found or you do not have access.</div>;
  }

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="h-16 flex items-center justify-between bg-slate-900 text-white p-4">
        <h1 className="font-bold text-xl">IFA Connect Video Session</h1>
        <span>
          Room: <span className="font-mono">{session.jitsi_room_name || `session-${session.id}`}</span>
        </span>
      </div>
      <div ref={jitsiRef} className="flex-1 w-full" />
    </div>
  );
};

export default SessionVideoRoom;
