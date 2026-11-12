import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, Clock, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Panel } from '@/components/dashboard/shell/Panel';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserSessions } from '@/hooks/useUserSessions';
import { supabase } from '@/integrations/supabase/client';
import { sessionEnd, sessionStart, sessionTimeRange } from '@/utils/sessionTime';

type Session = NonNullable<ReturnType<typeof useUserSessions>['data']>[number];
interface MyReview { session_id: number; rating: number; comment: string | null; is_approved: boolean }

const Stars = ({ n, size = 'h-4 w-4' }: { n: number; size?: string }) => (
  <span className="flex gap-0.5" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= n ? 'fill-sun text-sun' : 'text-line'}`} />)}
  </span>
);

/** Past consultations with what the Babalawo recorded, and the client's review. */
const SessionHistory = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sessions, isLoading, error } = useUserSessions();
  const { data: reviews } = useQuery({
    queryKey: ['my-reviews', user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from('reviews').select('session_id, rating, comment, is_approved').eq('user_id', user!.id);
      return Object.fromEntries(((data ?? []) as MyReview[]).map((r) => [String(r.session_id), r])) as Record<string, MyReview>;
    },
  });
  const { data: disputes } = useQuery({
    queryKey: ['my-disputes', user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from('disputes').select('session_id, status').eq('raised_by', user!.id);
      return Object.fromEntries(((data ?? []) as { session_id: number; status: string }[]).map((d) => [String(d.session_id), d.status]));
    },
  });
  const [reporting, setReporting] = useState<Session | null>(null);
  const [problem, setProblem] = useState('');
  const [wantRefund, setWantRefund] = useState(false);
  const [tab, setTab] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Session | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-panel bg-line" />)}</div>;
  if (error) return <p className="text-coral">Could not load your sessions: {(error as Error).message}</p>;

  const now = new Date();
  const past = (sessions ?? [])
    .filter((s) => s.status === 'completed' || s.status === 'cancelled' || sessionEnd(s) < now)
    .sort((a, b) => +sessionStart(b) - +sessionStart(a));
  const shown = tab === 'all' ? past : past.filter((s) => s.status === tab);

  const submit = async () => {
    if (!reviewing || !user) return;
    if (rating < 1) return toast({ title: 'Choose a rating from 1 to 5 stars', variant: 'destructive' });
    setBusy(true);
    const { error } = await (supabase as any).from('reviews').insert({
      session_id: Number(reviewing.id), user_id: user.id, babalawo_id: reviewing.babalawo_id, rating, comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Review not saved', description: error.message, variant: 'destructive' });
    toast({ title: 'Thank you for your review' });
    setReviewing(null);
    qc.invalidateQueries({ queryKey: ['my-reviews', user.id] });
  };

  const report = async () => {
    if (!reporting || !user) return;
    if (problem.trim().length < 10) return toast({ title: 'Tell us a little more (at least 10 characters)', variant: 'destructive' });
    setBusy(true);
    const { error } = await (supabase as any).from('disputes').insert({
      session_id: Number(reporting.id), raised_by: user.id, reason: problem.trim(), refund_requested: wantRefund,
    });
    setBusy(false);
    if (error) return toast({ title: 'Not sent', description: error.message, variant: 'destructive' });
    toast({ title: 'We have your report', description: 'Our team will look into it and reply by SMS or WhatsApp.' });
    setReporting(null);
    qc.invalidateQueries({ queryKey: ['my-disputes', user.id] });
  };
  const DISPUTE_LABEL: Record<string, string> = {
    open: 'You reported a problem. We are looking into it.', investigating: 'We are looking into your report.',
    resolved_refund: 'Your report was resolved with a refund.', resolved_dismissed: 'Your report was reviewed and closed.',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {(['all', 'completed', 'cancelled'] as const).map((t) => (
          <Button key={t} role="tab" aria-selected={tab === t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t === 'completed' ? 'Completed' : 'Cancelled'}
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Panel className="py-10 text-center">
          <Calendar className="mx-auto mb-3 h-12 w-12 text-line" />
          <p className="font-semibold">No {tab === 'all' ? 'past' : tab} sessions yet</p>
          <p className="text-sm text-muted-foreground">Consultations appear here once they have taken place.</p>
        </Panel>
      ) : shown.map((s) => {
        const id = String(s.id);
        const review = reviews?.[id];
        const isOpen = open === id;
        const odus = Array.isArray(s.other_odus) ? s.other_odus : [];
        return (
          <Panel key={id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-extrabold">{s.babalawo_name}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{format(sessionStart(s), 'EEE d MMM yyyy')}</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{sessionTimeRange(s)}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {review && <Stars n={review.rating} />}
                <Badge variant="outline">{s.status === 'cancelled' ? 'Cancelled' : 'Completed'}</Badge>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {s.status === 'completed' && !review && (
                <Button variant="outline" size="sm" onClick={() => { setReviewing(s); setRating(0); setComment(''); }}>
                  <MessageSquare className="h-4 w-4" /> Write a review
                </Button>
              )}
              {review && <p className="text-sm text-muted-foreground">{review.is_approved ? 'Your review is published.' : 'Your review is waiting for approval.'}</p>}
              {disputes?.[id] ? (
                <p className="text-sm font-semibold text-camwood">{DISPUTE_LABEL[disputes[id]] ?? 'Reported'}</p>
              ) : (s.status === 'completed' || s.status === 'cancelled') && (
                <Button variant="ghost" size="sm" onClick={() => { setReporting(s); setProblem(''); setWantRefund(false); }}>
                  <AlertTriangle className="h-4 w-4" /> Report a problem
                </Button>
              )}
              {s.status === 'completed' && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(isOpen ? null : id)}>
                  {isOpen ? <><ChevronUp className="h-4 w-4" /> Hide outcome</> : <><ChevronDown className="h-4 w-4" /> What Ifá said</>}
                </Button>
              )}
            </div>

            {isOpen && (
              <dl className="mt-4 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold text-muted-foreground">Primary Odù</dt><dd className="m-0">{s.primary_odu || 'Not recorded yet'}</dd></div>
                {odus.length > 0 && <div><dt className="font-semibold text-muted-foreground">Other Odù</dt><dd className="m-0">{odus.join(', ')}</dd></div>}
                <div className="sm:col-span-2"><dt className="font-semibold text-muted-foreground">Ebo or Etutu advised</dt><dd className="m-0">{s.ritual_recommendations || 'None recorded'}</dd></div>
                {s.items_needed && s.items_needed.length > 0 && <div className="sm:col-span-2"><dt className="font-semibold text-muted-foreground">Items</dt><dd className="m-0">{s.items_needed.join(', ')}</dd></div>}
                {s.next_appointment && <div><dt className="font-semibold text-muted-foreground">Next consultation</dt><dd className="m-0">{format(new Date(s.next_appointment), 'd MMM yyyy')}</dd></div>}
                <p className="text-muted-foreground sm:col-span-2">Full notes and any Ebo quote are under Notes & Ebo.</p>
              </dl>
            )}
          </Panel>
        );
      })}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review your consultation</DialogTitle>
            <DialogDescription>How was your consultation with {reviewing?.babalawo_name}? Your review helps others choose.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}>
                  <Star className={`h-9 w-9 ${n <= rating ? 'fill-sun text-sun' : 'text-line'}`} />
                </button>
              ))}
            </div>
            <Textarea rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What helped? (optional)" />
            <p className="text-xs text-muted-foreground">Reviews can't be changed once sent. Your name is shown with it.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send review'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reporting} onOpenChange={(o) => !o && setReporting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              Tell us what went wrong with your consultation with {reporting?.babalawo_name}. While we look into it, the Babalawo is not paid for it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea rows={5} maxLength={4000} value={problem} onChange={(e) => setProblem(e.target.value)}
              placeholder="For example: the Babalawo never joined, the call kept dropping, or they did not send the notes they promised." />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={wantRefund} onChange={(e) => setWantRefund(e.target.checked)} /> I would like a refund
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReporting(null)}>Cancel</Button>
            <Button onClick={report} disabled={busy}>{busy ? 'Sending…' : 'Send report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessionHistory;
