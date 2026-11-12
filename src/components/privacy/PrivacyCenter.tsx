import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Panel, PanelHeader } from '@/components/dashboard/shell/Panel';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePrivacyContacts } from '@/hooks/usePlatformRules';
import { downloadJson, privacyApi, readBrowserChoices, REQUEST_TYPES, requestLabel, saveBrowserChoices, STATUS_LABEL,
  type ConsentPurpose, type RequestType } from '@/lib/privacy';
import { usePrivacyStatus } from './ConsentGate';

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Settings -> Your privacy. Everything the NDPA and GDPR let a person do, in one place:
 * change consents, withdraw recording consent, download their data, and send a request.
 */
export function PrivacyCenter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: status, isLoading } = usePrivacyStatus();
  const contacts = usePrivacyContacts();
  const [busy, setBusy] = useState<string | null>(null);
  const [type, setType] = useState<RequestType>('access');
  const [details, setDetails] = useState('');
  const [confirm, setConfirm] = useState<null | 'special' | 'recordings'>(null);
  const [errorReports, setErrorReports] = useState(readBrowserChoices()?.errorReports !== false);

  if (!user) return null;
  const granted = (p: ConsentPurpose) => status?.consents?.[p]?.granted === true;
  const refresh = (s?: unknown) => s ? qc.setQueryData(['privacy-status', user.id], s) : qc.invalidateQueries({ queryKey: ['privacy-status', user.id] });

  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (done) toast({ title: done });
      return r;
    } catch (e) {
      toast({ title: 'That didn’t work', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const setConsent = (p: ConsentPurpose, v: boolean, done: string) =>
    run(p, async () => refresh(await privacyApi.record({ [p]: v }, 'settings')), done);

  return (
    <Panel className="lg:col-span-2" id="privacy">
      <PanelHeader eyebrow="Your data" title="Your privacy" />
      <p className="mb-5 max-w-[70ch] text-muted-foreground">
        You control what we keep about you. Read the <Link to="/privacy" className="underline">Privacy policy</Link> for the details,
        or write to our Data Protection Officer at <a className="underline" href={`mailto:${contacts.dpoEmail}`}>{contacts.dpoEmail}</a>.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h3 className="mb-1 font-display text-lg font-bold">What you agreed to</h3>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="divide-y divide-line">
              <label className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-semibold">Consultation content</span>
                  <span className="text-sm text-muted-foreground">Needed to consult. It can reveal your beliefs and health.</span>
                </span>
                <Switch checked={granted('special_category')} disabled={!!busy}
                  onCheckedChange={(v) => v ? setConsent('special_category', true, 'Thank you') : setConfirm('special')} />
              </label>
              <label className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-semibold">News and offers</span>
                  <span className="text-sm text-muted-foreground">Occasional messages from IFA.ng. Off unless you turn it on.</span>
                </span>
                <Switch checked={granted('marketing')} disabled={!!busy}
                  onCheckedChange={(v) => setConsent('marketing', v, v ? 'You’ll get news and offers' : 'No more news and offers')} />
              </label>
              <label className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block font-semibold">Crash reports from this browser</span>
                  <span className="text-sm text-muted-foreground">The error, the page and the browser. No cookies, no account details.</span>
                </span>
                <Switch checked={errorReports} onCheckedChange={(v) => { setErrorReports(v); saveBrowserChoices({ errorReports: v }); }} />
              </label>
              <div className="py-3">
                <span className="block font-semibold">Recordings and AI notes</span>
                <span className="block text-sm text-muted-foreground">
                  You choose before each consultation. You can also withdraw for past ones: we delete the recordings and transcripts.
                  Notes your Babalawo already approved stay with your consultation.
                </span>
                <Button variant="outline" size="sm" className="mt-3" disabled={!!busy} onClick={() => setConfirm('recordings')}>
                  Withdraw for all my consultations
                </Button>
              </div>
            </div>
          )}
          {status?.consents?.terms && (
            <p className="mt-2 text-xs text-muted-foreground">
              You agreed to the terms and privacy policy version {status.consents.terms.version} on {fmt(status.consents.terms.at)}.
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1 font-display text-lg font-bold">Your data</h3>
          <p className="text-sm text-muted-foreground">
            Everything we hold about you, as a file you can open or take to another service. Recordings and photos are listed; ask us for copies.
          </p>
          <Button className="mt-3" variant="outline" disabled={!!busy}
            onClick={() => run('export', async () => downloadJson(await privacyApi.exportMine(), `ifa-ng-my-data-${new Date().toISOString().slice(0, 10)}.json`), 'Your data is downloading')}>
            {busy === 'export' ? <Loader2 className="animate-spin" /> : <Download />} Download my data
          </Button>

          <h3 className="mb-1 mt-8 font-display text-lg font-bold">Ask us something</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pr-type">What do you need?</Label>
              <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
                <SelectTrigger id="pr-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{REQUEST_TYPES.find((r) => r.value === type)?.help}</p>
            </div>
            <div>
              <Label htmlFor="pr-details">Details</Label>
              <Textarea id="pr-details" value={details} maxLength={4000} rows={3} onChange={(e) => setDetails(e.target.value)}
                placeholder={type === 'rectification' ? 'What is wrong, and what should it say?' : 'Anything that helps us'} />
            </div>
            <Button disabled={!!busy || (type === 'rectification' && details.trim().length < 3)}
              onClick={() => run('request', async () => {
                const r = await privacyApi.request(type, details.trim());
                setDetails('');
                refresh();
                toast({ title: 'Request sent', description: `We will answer by ${fmt(r.due_at)}.` });
              })}>
              {busy === 'request' ? <Loader2 className="animate-spin" /> : 'Send request'}
            </Button>
          </div>
        </section>
      </div>

      {!!status?.requests?.length && (
        <section className="mt-8">
          <h3 className="mb-2 font-display text-lg font-bold">Your requests</h3>
          <ul className="divide-y divide-line">
            {status.requests.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{requestLabel(r.type)}</span>
                  <span className="text-muted-foreground"> · {fmt(r.received_at)}</span>
                  {r.response && <span className="block text-muted-foreground">{r.response}</span>}
                </span>
                <span className="rounded-pill bg-cloth px-2.5 py-0.5 text-xs font-bold">
                  {STATUS_LABEL[r.status]}{r.status !== 'completed' && r.status !== 'rejected' ? ` · due ${fmt(r.due_at)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'special' ? 'Withdraw consent for consultation content?' : 'Delete recordings and transcripts?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'special'
                ? 'You won’t be able to book or join consultations until you agree again. What you already shared stays until you delete your account or ask us to erase it.'
                : 'We delete every recording and transcript of your consultations and stop any that are being processed. This can’t be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirm === 'special') setConsent('special_category', false, 'Consent withdrawn');
              else run('recordings', async () => {
                const r = await privacyApi.withdrawRecordings();
                refresh();
                toast({ title: 'Recording consent withdrawn', description: `${r.files} file(s) will be deleted from ${r.sessions} consultation(s).` });
              });
              setConfirm(null);
            }}>{confirm === 'special' ? 'Withdraw' : 'Delete them'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
