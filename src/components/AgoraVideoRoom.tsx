
import React, { useEffect, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionById } from '@/hooks/useSessionById';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

const AgoraVideoRoom = () => {
  const { user, userProfile } = useAuth();
  const { sessionId } = useParams();
  const { data: session, isLoading, error } = useSessionById(sessionId || "");
  
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  // Only allow the session user or babalawo to join
  if (!isLoading && session && user) {
    if (user.id !== session.user_id && user.id !== session.babalawo_id) {
      return <Navigate to="/" replace />;
    }
  }

  const getUserRole = () => {
    if (!session || !user) return null;
    return user.id === session.user_id ? 'user' : 'babalawo';
  };

  const joinChannel = async () => {
    if (!session || !user) return;
    
    setIsConnecting(true);
    
    try {
      // Get Agora token from our edge function
      const { data, error } = await supabase.functions.invoke('generate-agora-token', {
        body: {
          session_id: session.id,
          role: getUserRole()
        }
      });

      if (error || !data) {
        console.error('Error getting token:', error);
        toast({
          title: "Connection Error",
          description: "Failed to get session token",
          variant: "destructive"
        });
        return;
      }

      const { channelName, token, uid, appId } = data;

      // Initialize Agora client
      const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      setClient(agoraClient);

      // Join the channel
      await agoraClient.join(appId, channelName, token, uid);
      
      // Create local tracks
      const [videoTrack, audioTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }

      // Publish local tracks
      await agoraClient.publish([videoTrack, audioTrack]);

      // Handle remote users
      agoraClient.on("user-published", async (remoteUser, mediaType) => {
        await agoraClient.subscribe(remoteUser, mediaType);
        
        if (mediaType === "video" && remoteVideoRef.current) {
          remoteUser.videoTrack?.play(remoteVideoRef.current);
        }
        
        if (mediaType === "audio") {
          remoteUser.audioTrack?.play();
        }
      });

      agoraClient.on("user-unpublished", (remoteUser) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.innerHTML = "";
        }
      });

      setIsJoined(true);
      
      // Log session start
      await logSessionAction('joined');

      toast({
        title: "Connected",
        description: "Successfully joined the consultation session"
      });

    } catch (error) {
      console.error('Error joining channel:', error);
      toast({
        title: "Connection Error",
        description: "Failed to join the session",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const leaveChannel = async () => {
    if (client && isJoined) {
      // Clean up local tracks
      localVideoTrack?.close();
      localAudioTrack?.close();
      
      // Leave channel
      await client.leave();
      
      // Log session end
      await logSessionAction('left');
      
      setIsJoined(false);
      setClient(null);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      
      toast({
        title: "Session Ended",
        description: "You have left the consultation session"
      });
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      if (isVideoEnabled) {
        localVideoTrack.setEnabled(false);
        setIsVideoEnabled(false);
      } else {
        localVideoTrack.setEnabled(true);
        setIsVideoEnabled(true);
      }
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack) {
      if (isAudioEnabled) {
        localAudioTrack.setEnabled(false);
        setIsAudioEnabled(false);
      } else {
        localAudioTrack.setEnabled(true);
        setIsAudioEnabled(true);
      }
    }
  };

  const logSessionAction = async (action: string) => {
    if (!session || !user) return;
    
    try {
      await supabase.from('session_logs').insert({
        session_id: session.id,
        user_id: user.id,
        action,
        metadata: { 
          role: getUserRole(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error logging session action:', error);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isJoined) {
        leaveChannel();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center mt-8 text-red-600">
        Session not found or you do not have access.
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="h-16 flex items-center justify-between bg-slate-900 text-white px-4">
        <h1 className="font-bold text-xl">IFA Connect - Agora Session</h1>
        <span className="text-sm">
          Session: {session.id.slice(0, 8)}...
        </span>
      </div>

      {/* Video Container */}
      <div className="flex-1 flex">
        {/* Remote Video */}
        <div className="flex-1 relative bg-black">
          <div ref={remoteVideoRef} className="w-full h-full" />
          {!isJoined && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Phone className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Waiting for connection...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video */}
        <div className="w-80 h-60 absolute bottom-20 right-4 bg-black rounded-lg overflow-hidden border-2 border-white">
          <div ref={localVideoRef} className="w-full h-full" />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-800">
              <VideoOff className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="h-20 bg-slate-800 flex items-center justify-center gap-4">
        {!isJoined ? (
          <Button
            onClick={joinChannel}
            disabled={isConnecting}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Join Session
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              onClick={toggleAudio}
              variant={isAudioEnabled ? "secondary" : "destructive"}
              size="lg"
            >
              {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            
            <Button
              onClick={toggleVideo}
              variant={isVideoEnabled ? "secondary" : "destructive"}
              size="lg"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            
            <Button
              onClick={leaveChannel}
              variant="destructive"
              size="lg"
              className="px-8"
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              End Session
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AgoraVideoRoom;
