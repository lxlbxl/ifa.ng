
import React, { useState } from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Video, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isAfter, subMinutes } from 'date-fns';
import FindBabalawo from './FindBabalawo';

const UpcomingSessions = () => {
  const { data: sessions, isLoading, isError, error } = useUserSessions();
  const [showFinder, setShowFinder] = useState(false);

  const upcomingSessions = sessions?.filter(s => new Date(s.session_date) >= new Date() && s.status === 'confirmed');

  const canJoinSession = (session: any) => {
    const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
    const now = new Date();
    // Allow joining 10 minutes before the session
    const joinTime = subMinutes(sessionDateTime, 10);
    return isAfter(now, joinTime);
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (isError) {
      return <div className="text-red-500 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Error: {error.message}</div>;
    }

    if (!upcomingSessions || upcomingSessions.length === 0) {
      return (
        <div className="text-center text-gray-500 py-6 sm:py-8">
          <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-sm sm:text-base">No upcoming sessions.</p>
          <Button variant="secondary" className="mt-4 text-sm" onClick={() => setShowFinder(true)}>
            Book a new session
          </Button>
          {showFinder && (
            <div className="mt-6 sm:mt-8">
              <FindBabalawo />
              <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={() => setShowFinder(false)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        {upcomingSessions.map((session: any) => (
          <div key={session.id} className="bg-white p-3 sm:p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                <AvatarImage src={session.babalawos?.profiles?.avatar_url} />
                <AvatarFallback>{session.babalawos?.profiles?.full_name?.[0] || 'B'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm sm:text-base text-gray-800">{session.babalawos?.profiles?.full_name || "Babalawo"}</p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {format(new Date(`${session.session_date}T${session.start_time}`), 'EEE, MMM d, yyyy')} at {format(new Date(`${session.session_date}T${session.start_time}`), 'p')}
                </p>
              </div>
            </div>
            <Button 
              className="w-full sm:w-auto text-sm"
              disabled={!canJoinSession(session)}
              onClick={() => window.open(`/sessions/${session.id}/video`, "_blank")}
            >
              <Video className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              {canJoinSession(session) ? "Join Session" : "Available 10 min before"}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="shadow-lg bg-white/50">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-lg sm:text-xl">Upcoming Consultations</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};

export default UpcomingSessions;
