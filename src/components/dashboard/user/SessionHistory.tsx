
import React from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Calendar, Clock, User, Star, Download } from 'lucide-react';
import { format } from 'date-fns';

const SessionHistory = () => {
  const { data: sessions, isLoading, error } = useUserSessions();

  if (isLoading) {
    return (
      <div className="bg-white/50 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Session History</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-32 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/50 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Session History</h2>
        <div className="text-red-500">Error loading session history: {error.message}</div>
      </div>
    );
  }

  const completedSessions = sessions?.filter(session => 
    session.status === 'completed' || new Date(session.session_date) < new Date()
  ) || [];

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Session History</h2>
      
      {completedSessions.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No completed sessions</h3>
          <p className="text-gray-400">Your completed sessions will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {completedSessions.map((session) => (
            <div key={session.id} className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {session.babalawo?.profile?.full_name || 'Babalawo'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">
                      {session.babalawo?.specialties?.join(', ') || 'General consultation'}
                    </p>
                    <div className="flex items-center text-sm text-gray-600 space-x-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(session.session_date), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {session.start_time} - {session.end_time}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">Completed</span>
                </div>
              </div>
              
              {session.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Session Notes:</strong> {session.notes}
                  </p>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex space-x-2">
                  <button className="flex items-center px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 transition-colors">
                    <Download className="h-3 w-3 mr-1" />
                    Transcript
                  </button>
                  <button className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors">
                    Write Review
                  </button>
                </div>
                
                <button className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                  Rebook
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionHistory;
