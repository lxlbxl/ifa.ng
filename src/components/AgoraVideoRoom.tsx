import React, { useState, useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, FileText } from "lucide-react";
import { generateAgoraToken } from "@/services/agoraService";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import SessionOutcomeModal from "./SessionOutcomeModal";

interface AgoraVideoRoomProps {
  sessionId: string;
  onLeave: () => void;
}

const AgoraVideoRoom: React.FC<AgoraVideoRoomProps> = ({ sessionId, onLeave }) => {
  const { user, userProfile } = useAuth();
  const { data: session } = useSessionById(sessionId);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<{ token: string; appId: string } | null>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

  // Check if current user is the babalawo for this session
  const isBabalawo = userProfile?.role === 'babalawo' && user?.id === session?.babalawo_id;

  useEffect(() => {
    const initializeAgora = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Generate Agora token
        console.log("🎥 Fetching Agora token for session:", sessionId);
        const tokenResponse = await generateAgoraToken(sessionId, user?.id);
        setTokenData(tokenResponse);

        // Initialize Agora client
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        // Event handlers
        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video") {
            const remoteVideoTrack = user.videoTrack;
            if (remoteVideoTrack && remoteVideoRef.current) {
              remoteVideoTrack.play(remoteVideoRef.current);
            }
          }
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            if (remoteAudioTrack) {
              remoteAudioTrack.play();
            }
          }
          setRemoteUsers(prevUsers => [...prevUsers.filter(u => u.uid !== user.uid), user]);
        });

        client.on("user-unpublished", (user) => {
          setRemoteUsers(prevUsers => prevUsers.filter(u => u.uid !== user.uid));
        });

        client.on("user-left", (user) => {
          setRemoteUsers(prevUsers => prevUsers.filter(u => u.uid !== user.uid));
        });

        // Join channel
        console.log("🚀 Joining Agora channel:", sessionId);
        await client.join(
          tokenResponse.appId,
          sessionId,
          tokenResponse.token,
          user?.id || null
        );

        // Create and publish local tracks
        console.log("📹 Creating local video and audio tracks");
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        // Play local video
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        // Publish tracks
        await client.publish([audioTrack, videoTrack]);
        setIsJoined(true);
        console.log("✅ Successfully joined Agora channel");

      } catch (error: any) {
        console.error("❌ Failed to initialize Agora:", error);
        setError(error.message || "Failed to initialize video session");
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId && user) {
      initializeAgora();
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.leave();
      }
    };
  }, [sessionId, user?.id]);

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const handleLeave = async () => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (clientRef.current) {
      await clientRef.current.leave();
    }
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

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Connection Status */}
      {!isJoined && (
        <div className="bg-yellow-600 text-white text-center py-2">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Joining video session...
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Local Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <div ref={localVideoRef} className="w-full h-full min-h-[300px]" />
          <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
            You {!isVideoEnabled && "(Video Off)"}
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <div ref={remoteVideoRef} className="w-full h-full min-h-[300px]" />
          {remoteUsers.length > 0 ? (
            <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              Remote User
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Waiting for other participant...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 p-6 bg-gray-800">
        <Button
          onClick={toggleAudio}
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-12 h-12 p-0"
          disabled={!isJoined}
        >
          {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>
        
        <Button
          onClick={toggleVideo}
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-12 h-12 p-0"
          disabled={!isJoined}
        >
          {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>

        {/* End Session button for Babalawos */}
        {isBabalawo && (
          <Button
            onClick={() => setShowOutcomeModal(true)}
            variant="outline"
            size="lg"
            className="rounded-full w-12 h-12 p-0"
            disabled={!isJoined}
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

export default AgoraVideoRoom;
