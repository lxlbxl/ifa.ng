import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, PhoneOff, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import { createDailyRoom } from "@/services/dailyService";
import { supabase } from "@/integrations/supabase/client";
import SessionOutcomeModal from "./SessionOutcomeModal";

interface DailyVideoRoomProps {
  sessionId: string;
  onLeave: () => void;
}

const DailyVideoRoom: React.FC<DailyVideoRoomProps> = ({ sessionId, onLeave }) => {
  const { user, userProfile } = useAuth();
  const { data: session, mutate: refreshSession } = useSessionById(sessionId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Check if current user is the babalawo for this session
  const isBabalawo = userProfile?.role === 'babalawo' && user?.id === session?.babalawo_id;

  // Add debugging logs
  console.log("[DailyVideoRoom] sessionId:", sessionId);
  console.log("[DailyVideoRoom] session:", session);
  console.log("[DailyVideoRoom] user:", user);
  console.log("[DailyVideoRoom] isLoading:", isLoading);
  console.log("[DailyVideoRoom] error:", error);
  console.log("[DailyVideoRoom] roomUrl:", roomUrl);

  useEffect(() => {
    const initializeDaily = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("[DailyVideoRoom] Initializing Daily.co room");
        console.log("[DailyVideoRoom] Session room_url:", session?.room_url);

        // Check if session already has a room URL
        if (session?.room_url) {
          console.log("[DailyVideoRoom] Using existing room URL:", session.room_url);
          setRoomUrl(session.room_url);
          setIsLoading(false);
          return;
        }

        // Create a new Daily.co room
        console.log("🎥 Creating Daily.co room for session:", sessionId);
        const response = await createDailyRoom(sessionId);
        
        // Save the room URL to the session
        if (response.roomUrl) {
          await supabase
            .from("sessions")
            .update({ room_url: response.roomUrl })
            .eq("id", sessionId);
          
          setRoomUrl(response.roomUrl);
          refreshSession(); // Refresh session data
        }
      } catch (error: any) {
        console.error("❌ Failed to initialize Daily.co:", error);
        setError(error.message || "Failed to initialize video session");
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId && user) {
      initializeDaily();
    }
  }, [sessionId, user?.id, session?.room_url]);

  const handleLeave = () => {
    onLeave();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Connecting to video session...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-red-400 mb-4">
            <PhoneOff className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Connection Failed</h2>
          </div>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button onClick={onLeave} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Show room not found state
  if (!roomUrl) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-red-400 mb-4">
            <PhoneOff className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Room Not Found</h2>
          </div>
          <p className="text-gray-300 mb-6">The video room could not be created or found.</p>
          <Button onClick={onLeave} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Daily.co iframe */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          title="Daily.co Video Call"
          src={roomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture"
          className="w-full h-full min-h-[calc(100vh-80px)]"
        ></iframe>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 p-6 bg-gray-800">
        {/* End Session button for Babalawos */}
        {isBabalawo && (
          <Button
            onClick={() => setShowOutcomeModal(true)}
            variant="outline"
            size="lg"
            className="rounded-full w-12 h-12 p-0"
          >
            <FileText className="h-6 w-6" />
          </Button>
        )}
        
        <Button
          onClick={handleLeave}
          variant="destructive"
          size="lg"
          className="rounded-full w-12 h-12 p-0"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>

      {/* Session Outcome Modal */}
      <SessionOutcomeModal
        isOpen={showOutcomeModal}
        onClose={() => setShowOutcomeModal(false)}
        sessionId={sessionId}
        onSuccess={() => {
          setShowOutcomeModal(false);
          handleLeave();
        }}
      />
    </div>
  );
};

export default DailyVideoRoom;