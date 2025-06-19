
import React, { useEffect, useState, useRef } from 'react';
import AgoraRTC, { 
  IAgoraRTCClient, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser
} from 'agora-rtc-sdk-ng';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionById } from '@/hooks/useSessionById';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AgoraVideoRoom = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { data: session } = useSessionById(sessionId || "");
  const { toast } = useToast();

  const [client] = useState<IAgoraRTCClient>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setupAgora = async () => {
      // Set up client event handlers
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === 'video' && remoteVideoRef.current) {
          user.videoTrack?.play(remoteVideoRef.current);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
        
        setRemoteUsers(prevUsers => {
          const existingUser = prevUsers.find(u => u.uid === user.uid);
          if (existingUser) {
            return prevUsers.map(u => u.uid === user.uid ? user : u);
          }
          return [...prevUsers, user];
        });
      });

      client.on('user-unpublished', (user) => {
        setRemoteUsers(prevUsers => prevUsers.filter(u => u.uid !== user.uid));
      });

      client.on('user-left', (user) => {
        setRemoteUsers(prevUsers => prevUsers.filter(u => u.uid !== user.uid));
      });
    };

    setupAgora();

    return () => {
      leaveSession();
    };
  }, [client]);

  const joinSession = async () => {
    if (!session || !user) return;

    setIsLoading(true);
    try {
      // Generate Agora token
      const { data, error } = await supabase.functions.invoke('generate-agora-token', {
        body: {
          session_id: sessionId,
          role: user.id === session.babalawo_id ? 'babalawo' : 'user'
        }
      });

      if (error) {
        console.error('Token generation error:', error);
        toast({
          title: "Error",
          description: "Failed to generate session token",
          variant: "destructive",
        });
        return;
      }

      const { channelName, token, uid } = data;

      // Create local tracks
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      
      setLocalVideoTrack(videoTrack);
      setLocalAudioTrack(audioTrack);

      // Join the channel
      await client.join(data.appId, channelName, token, uid);
      
      // Publish local tracks
      await client.publish([videoTrack, audioTrack]);

      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }

      setIsJoined(true);

      // Log session start
      await supabase.from('session_logs').insert({
        session_id: sessionId,
        user_id: user.id,
        action: 'joined',
        metadata: { timestamp: new Date().toISOString() }
      });

      toast({
        title: "Joined Session",
        description: "You have successfully joined the consultation session",
      });

    } catch (error) {
      console.error('Failed to join session:', error);
      toast({
        title: "Error",
        description: "Failed to join session",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const leaveSession = async () => {
    try {
      // Stop and close local tracks
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }

      // Leave the channel
      await client.leave();

      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setRemoteUsers([]);
      setIsJoined(false);

      // Log session end
      if (user && sessionId) {
        await supabase.from('session_logs').insert({
          session_id: sessionId,
          user_id: user.id,
          action: 'left',
          metadata: { timestamp: new Date().toISOString() }
        });
      }

      toast({
        title: "Left Session",
        description: "You have left the consultation session",
      });

    } catch (error) {
      console.error('Failed to leave session:', error);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 text-white">
        <h1 className="text-xl font-semibold">Spiritual Consultation Session</h1>
        <p className="text-gray-300">Session with {session?.profiles?.full_name}</p>
      </div>

      {/* Video Area */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Local Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <div 
            ref={localVideoRef}
            className="w-full h-64 lg:h-96 bg-gray-700 flex items-center justify-center"
          >
            {!isJoined && (
              <div className="text-white text-center">
                <p className="mb-4">Ready to join the session?</p>
                <Button onClick={joinSession} disabled={isLoading}>
                  {isLoading ? 'Joining...' : 'Join Session'}
                </Button>
              </div>
            )}
          </div>
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
            You {!isVideoEnabled && '(Video Off)'}
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <div 
            ref={remoteVideoRef}
            className="w-full h-64 lg:h-96 bg-gray-700 flex items-center justify-center"
          >
            {remoteUsers.length === 0 && isJoined && (
              <div className="text-white text-center">
                <p>Waiting for the other participant to join...</p>
              </div>
            )}
          </div>
          {remoteUsers.length > 0 && (
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              {session?.profiles?.full_name || 'Participant'}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      {isJoined && (
        <div className="bg-gray-800 p-4 flex justify-center space-x-4">
          <Button
            variant={isAudioEnabled ? "default" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-12 h-12"
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>
          
          <Button
            variant={isVideoEnabled ? "default" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12"
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            onClick={leaveSession}
            className="rounded-full w-12 h-12"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AgoraVideoRoom;
