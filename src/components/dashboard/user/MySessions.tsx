
import React from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Calendar, Clock, User, Video } from 'lucide-react';
import { format } from 'date-fns';

const MySessions = () => {
  const { data: sessions, isLoading, error } = useUserSessions();

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
        <div className="text-red-500">Error loading sessions: {error.message}</div>
      </div>
    );
  }

  const upcomingSessions = sessions?.filter(session => 
    new Date(session.session_date) >= new Date() && session.status !== 'completed'
  ) || [];

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">My Sessions</h2>
      
      {upcomingSessions.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No upcoming sessions</h3>
          <p className="text-gray-400">Book a session with a Babalawo to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingSessions.map((session) => (
            <div key={session.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {session.babalawos?.profiles?.full_name || 'Babalawo'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {session.babalawos?.specialties?.join(', ') || 'General consultation'}
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
                  'bg-gray-100 text-gray-800'
                }`}>
                  {session.status}
                </span>
                
                <div className="flex space-x-2">
                  <button className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                    <Video className="h-4 w-4 mr-2" />
                    Join Session
                  </button>
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Reschedule
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySessions;
