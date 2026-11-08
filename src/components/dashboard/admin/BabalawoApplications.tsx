import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, Phone, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { prettyPhone } from '@/lib/countries';
import { cn } from '@/lib/utils';

interface Application {
  id: number;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  ile_name: string | null;
  years_practising: number | null;
  specialties: string[];
  languages: string[];
  consults_online: string | null;
  bio: string | null;
  referral: string | null;
  status: 'waitlisted' | 'approved' | 'rejected';
  review_notes: string | null;
  created_at: string;
}

type Filter = 'waitlisted' | 'approved' | 'rejected' | 'all';

/** Babalawo applications from /become-a-babalawo. Approving makes the person a verified, visible Babalawo. */
export default function BabalawoApplications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('waitlisted');
  const [open, setOpen] = useState<Application | null>(null);
  const [reject, setReject] = useState<Application | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-babalawo-applications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('babalawo_applications' as never).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Application[];
    },
  });

  const decide = useMutation({
    mutationFn: async (v: { id: number; decision: 'approved' | 'rejected' | 'waitlisted'; notes?: string }) => {
      const { error } = await supabase.rpc('admin_review_babalawo_application' as never,
        { p_id: v.id, p_decision: v.decision, p_notes: v.notes ?? null } as never);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast({ title: v.decision === 'approved' ? 'Approved. They are now a verified Babalawo.' : v.decision === 'rejected' ? 'Application rejected' : 'Moved back to the waitlist' });
      setOpen(null); setReject(null); setReason('');
      qc.invalidateQueries({ queryKey: ['admin-babalawo-applications'] });
      qc.invalidateQueries({ queryKey: ['admin-babalawos'] });
    },
    onError: (e: Error) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const rows = (data ?? []).filter((a) => filter === 'all' || a.status === filter);
  const waiting = (data ?? []).filter((a) => a.status === 'waitlisted').length;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Babalawo applications</h2>
          <p className="text-sm text-muted-foreground">{waiting} waiting for review. Call the applicant before approving.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
          {(['waitlisted', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn('h-9 rounded-pill border-2 px-3.5 text-sm font-bold capitalize', filter === f ? 'border-ink bg-ink text-cloth' : 'border-line bg-paper')}>
              {f === 'waitlisted' ? `Waitlist (${waiting})` : f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <p className="rounded-panel bg-coral/10 p-4">Couldn’t load applications: {(error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-panel border border-line bg-paper p-8 text-center text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="grid list-none gap-3 p-0">
          {rows.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setOpen(a)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-panel border border-line bg-paper p-4 text-left hover:border-ink">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{a.full_name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[a.city, a.country].filter(Boolean).join(', ')}{a.years_practising ? ` · ${a.years_practising}+ yrs` : ''} · {a.specialties.slice(0, 3).join(', ')}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                <StatusPill status={a.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.full_name}</DialogTitle>
                <DialogDescription>Applied {new Date(open.created_at).toLocaleString()}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-sm">
                {([
                  ['Phone', open.phone ? <a href={`tel:${open.phone}`} className="inline-flex items-center gap-1 font-semibold"><Phone className="h-3.5 w-3.5" />{prettyPhone(open.phone)}</a> : '—'],
                  ['Email', open.email ?? '—'],
                  ['Based in', [open.city, open.country].filter(Boolean).join(', ') || '—'],
                  ['Ilé / lineage', open.ile_name ?? '—'],
                  ['Practising', open.years_practising ? `about ${open.years_practising} years` : '—'],
                  ['Specialties', open.specialties.join(', ') || '—'],
                  ['Languages', open.languages.join(', ') || '—'],
                  ['Online before', open.consults_online ?? '—'],
                  ['Heard via', open.referral ?? '—'],
                  ['Status', <StatusPill key="s" status={open.status} />],
                ] as [string, React.ReactNode][]).map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="m-0">{v}</dd></div>
                ))}
              </dl>
              {open.bio && <p className="whitespace-pre-line rounded-field bg-cloth p-3 text-sm">{open.bio}</p>}
              {open.review_notes && <p className="text-sm"><b>Notes:</b> {open.review_notes}</p>}
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {open.status !== 'waitlisted' && (
                  <Button variant="outline" onClick={() => decide.mutate({ id: open.id, decision: 'waitlisted' })} disabled={decide.isPending}>
                    Back to waitlist
                  </Button>
                )}
                {open.status !== 'rejected' && (
                  <Button variant="outline" onClick={() => { setReject(open); setOpen(null); }} disabled={decide.isPending}>
                    <X /> Reject
                  </Button>
                )}
                {open.status !== 'approved' && (
                  <Button variant="sun" onClick={() => decide.mutate({ id: open.id, decision: 'approved' })} disabled={decide.isPending}>
                    {decide.isPending ? <Loader2 className="animate-spin" /> : <Check />} Approve
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {reject?.full_name}?</DialogTitle>
            <DialogDescription>The applicant sees this reason.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim() || decide.isPending}
              onClick={() => reject && decide.mutate({ id: reject.id, decision: 'rejected', notes: reason.trim() })}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusPill({ status }: { status: Application['status'] }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-bold capitalize',
      status === 'approved' ? 'bg-leaf' : status === 'rejected' ? 'bg-coral/20 text-coral-700' : 'bg-sun/60')}>
      {status === 'waitlisted' && <Clock className="h-3 w-3" />}{status}
    </span>
  );
}
