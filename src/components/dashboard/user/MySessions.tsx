import React from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Calendar, Clock, User, Video, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const MySessions = () => {
  const { data: sessions, isLoading, error, refetch } = useUserSessions();
  const navigate = useNavigate(); // Initialize useNavigate

  if (isLoading) {
    return (
      <div className="bg-white/50 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">My Sessions</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-24 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/50 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">My Sessions</h2>
        <div className="text-red-500 mb-4">Error loading sessions: {error.message}</div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');

  const relevantSessions = sessions?.filter(session => {
    const sessionDate = new Date(session.session_date);
    
    // Include sessions that are in_progress
    if (session.status === 'in_progress') {
      return true;
    }
    // Include confirmed sessions that are today or in the future
    if (session.status === 'confirmed' && sessionDate >= now) {
      return true;
    }
    return false;
  }).sort((a, b) => {
    // Sort by date and then time
    const dateTimeA = new Date(`${a.session_date}T${a.start_time}`);
    const dateTimeB = new Date(`${b.session_date}T${b.start_time}`);
    return dateTimeA.getTime() - dateTimeB.getTime();
  }) || [];

  console.log('[MySessions] Rendering sessions:', sessions);
  console.log('[MySessions] Relevant sessions:', relevantSessions);

  const handleJoinSession = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">My Sessions</h2>
      
      {relevantSessions.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No upcoming or in-progress sessions</h3>
          <p className="text-gray-400">Book a session with a Babalawo to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {relevantSessions.map((session) => {
            console.log(`[MySessions] Rendering session ${session.id} with babalawo: ${session.babalawo_name}`);
            
            const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
            const isJoinable = session.status === 'in_progress' || (session.status === 'confirmed' && sessionDateTime <= new Date(now.getTime() + 15 * 60 * 1000)); // Joinable 15 mins before start or if in_progress

            return (
              <div key={session.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12">
                      {session.babalawo_avatar ? (
                        <AvatarImage src={session.babalawo_avatar} alt={session.babalawo_name} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {session.babalawo_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {session.babalawo_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {session.session_type === 'ebo_ritual'
                          ? 'Ebo ritual (already paid)'
                          : session.babalawo_specialties?.join(', ') || 'General consultation'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(session.session_date), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      {session.start_time} - {session.end_time}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    session.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    session.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    session.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : // Added in_progress style
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status}
                  </span>
                  
                  <div className="flex space-x-2">
                    {isJoinable && ( // Conditionally render Join Session button
                      <Button onClick={() => handleJoinSession(String(session.id))} className="flex items-center">
                        <Video className="h-4 w-4 mr-2" />
                        Join Session
                      </Button>
                    )}
                    <Button variant="outline">
                      Reschedule
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MySessions;
