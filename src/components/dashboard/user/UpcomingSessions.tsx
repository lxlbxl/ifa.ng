
import React, { useState } from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Video, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import FindBabalawo from './FindBabalawo';

const UpcomingSessions = () => {
  const { data: sessions, isLoading, isError, error } = useUserSessions();
  const [showFinder, setShowFinder] = useState(false);

  const upcomingSessions = sessions?.filter(s => new Date(s.session_date) >= new Date() && s.status === 'confirmed');

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (isError) {
      return <div className="text-red-500 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Error: {error.message}</div>;
    }

    if (!upcomingSessions || upcomingSessions.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No upcoming sessions.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setShowFinder(true)}>
            Book a new session
          </Button>
          {showFinder && (
            <div className="mt-8">
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
      <div className="space-y-4">
        {upcomingSessions.map((session: any) => (
          <div key={session.id} className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={session.babalawos?.profiles?.avatar_url} />
                <AvatarFallback>{session.babalawos?.profiles?.full_name?.[0] || 'B'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-800">{session.babalawos?.profiles?.full_name}</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(`${session.session_date}T${session.start_time}`), 'EEE, MMM d, yyyy')} at {format(new Date(`${session.session_date}T${session.start_time}`), 'p')}
                </p>
              </div>
            </div>
            <Button>
              <Video className="mr-2 h-4 w-4" />
              Join Session
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="shadow-lg bg-white/50">
      <CardHeader>
        <CardTitle>Upcoming Consultations</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};

export default UpcomingSessions;
