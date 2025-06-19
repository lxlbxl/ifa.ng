
import { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, Phone, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface AgoraVideoRoomProps {
  sessionId: string;
  onLeave: () => void;
}

const AgoraVideoRoom: React.FC<AgoraVideoRoomProps> = ({ sessionId, onLeave }) => {
  const { user } = useAuth();
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        setLoading(true);
        
        // Fetch session data
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select(`
            *,
            babalawos!inner (
              id,
              profiles (
                id,
                full_name,
                avatar_url
              )
            )
          `)
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;
        if (!session) throw new Error('Session not found');

        setSessionData(session);

        // Generate Agora token
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('generate-agora-token', {
          body: { 
            session_id: sessionId,
            role: session.user_id === user?.id ? 'user' : 'babalawo'
          }
        });

        if (tokenError) throw tokenError;

        const { channelName, token, uid } = tokenData;

        // Initialize Agora client
        await client.join(tokenData.appId, channelName, token, uid);
        
        // Create local tracks
        const [videoTrack, audioTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);

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
          user_id: user?.id,
          action: 'joined',
          metadata: { timestamp: new Date().toISOString() }
        });

      } catch (err: any) {
        console.error('Failed to initialize session:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId && user) {
      initializeSession();
    }

    // Setup event listeners
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
        if (remoteVideoRef.current && user.videoTrack) {
          user.videoTrack.play(remoteVideoRef.current);
        }
      }
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-left', handleUserLeft);
    };
  }, [sessionId, user, client]);

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

      // Leave channel
      await client.leave();
      
      // Log session end
      await supabase.from('session_logs').insert({
        session_id: sessionId,
        user_id: user?.id,
        action: 'left',
        metadata: { timestamp: new Date().toISOString() }
      });

      // Update session end time
      await supabase
        .from('sessions')
        .update({ session_ended_at: new Date().toISOString() })
        .eq('id', sessionId);

      onLeave();
    } catch (err: any) {
      console.error('Error leaving session:', err);
      toast({
        title: "Error",
        description: "Failed to leave session properly",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Connecting to session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Connection Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={onLeave} variant="outline" className="w-full">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const babalawoProfile = sessionData?.babalawos?.profiles;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={babalawoProfile?.avatar_url} />
            <AvatarFallback>{babalawoProfile?.full_name?.[0] || 'B'}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-white font-semibold">{babalawoProfile?.full_name || "Babalawo"}</h2>
            <p className="text-gray-400 text-sm">Consultation Session</p>
          </div>
        </div>
        <div className="text-white text-sm">
          {isJoined ? 'Connected' : 'Connecting...'}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 flex">
        {/* Remote Video (Babalawo) */}
        <div className="flex-1 relative bg-gray-800">
          <div ref={remoteVideoRef} className="w-full h-full"></div>
          {remoteUsers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src={babalawoProfile?.avatar_url} />
                  <AvatarFallback className="text-2xl">{babalawoProfile?.full_name?.[0] || 'B'}</AvatarFallback>
                </Avatar>
                <p>Waiting for {babalawoProfile?.full_name || "Babalawo"} to join...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (User) */}
        <div className="w-80 bg-gray-700 relative">
          <div ref={localVideoRef} className="w-full h-full"></div>
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute bottom-4 left-4 text-white text-sm">
            You
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-center gap-4">
        <Button
          onClick={toggleAudio}
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-12 h-12 p-0"
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        
        <Button
          onClick={toggleVideo}
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-12 h-12 p-0"
        >
          {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          onClick={leaveSession}
          variant="destructive"
          size="lg"
          className="rounded-full w-12 h-12 p-0"
        >
          <Phone className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default AgoraVideoRoom;
