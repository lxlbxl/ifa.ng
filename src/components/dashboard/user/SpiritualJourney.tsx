import React from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { sessionStart, sessionTimeRange } from "@/utils/sessionTime";

const SpiritualJourney: React.FC = () => {
  const { data: sessions, isLoading, isError, error } = useUserSessions();

  if (isLoading) {
    return <div className="text-center py-8">Loading your spiritual journey...</div>;
  }

  if (isError) {
    return <div className="text-center py-8 text-coral">Error loading journey: {error?.message || 'Unknown error'}</div>;
  }

  if (!sessions || sessions.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No spiritual journey sessions found yet.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Spiritual Journey</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {sessions.map((session) => (
            <AccordionItem key={session.id} value={String(session.id)}>
              <AccordionTrigger>
                <div className="flex flex-col items-start">
                  <span className="font-semibold">Session with {session.babalawo_name} on {format(sessionStart(session), 'PPP')}</span>
                  <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className="mt-1">
                    {session.status}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 text-sm">
                  <p><strong>Time:</strong> {sessionTimeRange(session)}</p>
                  <p><strong>Notes:</strong> {session.notes || 'N/A'}</p>
                  {session.primary_odu && <p><strong>Primary Odu:</strong> {session.primary_odu}</p>}
                  {session.other_odus && (
                    <p><strong>Other Odus:</strong> {Array.isArray(session.other_odus) ? session.other_odus.join(', ') : session.other_odus}</p>
                  )}
                  {session.ritual_recommendations && <p><strong>Ritual Recommendations:</strong> {session.ritual_recommendations}</p>}
                  {session.items_needed && session.items_needed.length > 0 && (
                    <p><strong>Items Needed:</strong> {session.items_needed.join(', ')}</p>
                  )}
                  {session.deadline && <p><strong>Deadline:</strong> {format(new Date(session.deadline), 'PPP')}</p>}
                  {session.next_appointment && <p><strong>Next Appointment:</strong> {format(new Date(session.next_appointment), 'PPP')}</p>}
                  {session.consultation_notes && <p><strong>Consultation Notes:</strong> {session.consultation_notes}</p>}
                  {session.warnings && <p className="text-coral"><strong>Warnings:</strong> {session.warnings}</p>}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default SpiritualJourney;
