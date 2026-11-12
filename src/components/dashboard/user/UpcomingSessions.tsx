import React, { useState, useEffect } from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Calendar, 
  Video, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  MoreHorizontal
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { format, isAfter, subMinutes, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import FindBabalawo from './FindBabalawo';
import { sessionStart } from "@/utils/sessionTime";

const UpcomingSessions = () => {
  const { data: sessions, isLoading, isError, error } = useUserSessions();
  const [showFinder, setShowFinder] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [countdowns, setCountdowns] = useState<{[key: string]: string}>({});

  const upcomingSessions = sessions?.filter(s => 
    (sessionStart(s) >= new Date() && 
    ['confirmed', 'pending', 'awaiting_payment'].includes(s.status))
  );

  // Update countdowns every minute
  useEffect(() => {
    if (!upcomingSessions || upcomingSessions.length === 0) return;
    
    const updateCountdowns = () => {
      const newCountdowns: {[key: string]: string} = {};
      
      upcomingSessions.forEach((session: any) => {
        const sessionDateTime = sessionStart(session);
        const now = new Date();
        const diffMinutes = differenceInMinutes(sessionDateTime, now);
        const diffHours = differenceInHours(sessionDateTime, now);
        const diffDays = differenceInDays(sessionDateTime, now);
        
        let countdownText = '';
        
        if (diffDays > 0) {
          countdownText = `${diffDays}d ${diffHours % 24}h`;
        } else if (diffHours > 0) {
          countdownText = `${diffHours}h ${diffMinutes % 60}m`;
        } else if (diffMinutes > 0) {
          countdownText = `${diffMinutes}m`;
        } else {
          countdownText = 'Now';
        }
        
        newCountdowns[session.id] = countdownText;
      });
      
      setCountdowns(newCountdowns);
    };
    
    updateCountdowns();
    const interval = setInterval(updateCountdowns, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [upcomingSessions]);

  const canJoinSession = (session: any) => {
    const sessionDateTime = sessionStart(session);
    const now = new Date();
    // Allow joining 10 minutes before the session
    const joinTime = subMinutes(sessionDateTime, 10);
    return isAfter(now, joinTime);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>;
      case 'awaiting_payment':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Awaiting Payment</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Cancelled</Badge>;
      default:
        return <Badge className="bg-cloth text-ink hover:bg-line">{status}</Badge>;
    }
  };

  const getSessionDuration = (startTime: string, endTime: string) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const durationMinutes = differenceInMinutes(end, start);
    
    if (durationMinutes < 60) {
      return `${durationMinutes} min`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };

  const handleReschedule = (session: any) => {
    setSelectedSession(session);
    setShowRescheduleDialog(true);
  };

  const handleCancel = (session: any) => {
    setSelectedSession(session);
    setShowCancelDialog(true);
  };

  const confirmReschedule = () => {
    // Reschedule logic would go here
    alert('Reschedule request sent. You will be notified once the Babalawo confirms the new time.');
    setShowRescheduleDialog(false);
  };

  const confirmCancel = () => {
    // Cancel logic would go here
    alert('Session cancelled successfully.');
    setShowCancelDialog(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (isError) {
      return <div className="text-coral flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Error: {error.message}</div>;
    }

    if (!upcomingSessions || upcomingSessions.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-6 sm:py-8">
          <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-muted-foreground" />
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
      <div className="space-y-4 sm:space-y-5">
        {upcomingSessions.map((session: any) => (
          <Card key={session.id} className="overflow-hidden">
            <div className="bg-paper p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-primary/10">
                    <AvatarImage src={session.babalawo?.profile?.avatar_url} />
                    <AvatarFallback>{session.babalawo?.profile?.full_name?.[0] || 'B'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base sm:text-lg text-ink">
                        {session.babalawo?.profile?.full_name || "Babalawo"}
                      </h3>
                      {getStatusBadge(session.status)}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {session.babalawo?.specialties?.join(', ') || "Ifá Consultation"}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleReschedule(session)}>
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>Reschedule</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCancel(session)} className="text-coral">
                      <XCircle className="mr-2 h-4 w-4" />
                      <span>Cancel Session</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs mb-1 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" /> Date
                  </span>
                  <span className="font-medium">
                    {format(sessionStart(session), 'EEE, MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs mb-1 flex items-center">
                    <Clock className="h-3 w-3 mr-1" /> Time
                  </span>
                  <span className="font-medium">
                    {format(sessionStart(session), 'h:mm a')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs mb-1 flex items-center">
                    <Clock className="h-3 w-3 mr-1" /> Duration
                  </span>
                  <span className="font-medium">
                    {getSessionDuration(session.start_time, session.end_time)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs mb-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" /> Countdown
                  </span>
                  <span className="font-medium text-primary">
                    {countdowns[session.id] || 'Calculating...'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2 border-t border-line">
                <div className="flex items-center text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                  <span>
                    {session.status === 'confirmed' 
                      ? 'Your session is confirmed and ready to go!' 
                      : session.status === 'pending' 
                        ? 'Waiting for Babalawo to confirm' 
                        : 'Please complete payment to confirm'}
                  </span>
                </div>
                <Button 
                  className="w-full sm:w-auto"
                  disabled={!canJoinSession(session) || session.status !== 'confirmed'}
                  onClick={() => window.open(`/session/${session.id}`, "_blank")}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {canJoinSession(session) && session.status === 'confirmed' 
                    ? "Join Session" 
                    : session.status !== 'confirmed'
                      ? "Session not ready"
                      : "Available 10 min before"}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <Card className="shadow-lg bg-paper">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Your Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Session</DialogTitle>
            <DialogDescription>
              You can request to reschedule your session with {selectedSession?.babalawo?.profile?.full_name || "the Babalawo"}.
              The Babalawo will need to confirm the new time.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Current session: {selectedSession && format(sessionStart(selectedSession), 'EEE, MMM d, yyyy')} at {selectedSession && format(sessionStart(selectedSession), 'h:mm a')}
            </p>
            <div className="bg-yellow-50 p-3 rounded-md flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-700">
                  Rescheduling less than 24 hours before your session may incur a fee.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Please note: This is a placeholder for the rescheduling interface. In a complete implementation, 
              you would see a calendar and time picker here.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>Cancel</Button>
            <Button onClick={confirmReschedule}>Request Reschedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your session with {selectedSession?.babalawo?.profile?.full_name || "the Babalawo"}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Session details: {selectedSession && format(sessionStart(selectedSession), 'EEE, MMM d, yyyy')} at {selectedSession && format(sessionStart(selectedSession), 'h:mm a')}
            </p>
            <div className="bg-red-50 p-3 rounded-md flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-coral mt-0.5" />
              <div>
                <p className="text-sm text-red-700">
                  Cancellations less than 24 hours before your session may not be eligible for a refund.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Keep Session</Button>
            <Button variant="destructive" onClick={confirmCancel}>Cancel Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UpcomingSessions;
