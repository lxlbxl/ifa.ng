import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Panel, PanelHeader } from '@/components/dashboard/shell/Panel';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/** Account settings that really save: name, message channels, and deleting the account. */
const Settings = () => {
  const { user, userProfile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const p = userProfile as (typeof userProfile & { phone?: string | null; whatsapp_opt_in?: boolean | null; sms_opt_in?: boolean | null; timezone?: string | null }) | null;
  const [name, setName] = useState('');
  const [wa, setWa] = useState(true);
  const [sms, setSms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [walletNote, setWalletNote] = useState<string | null>(null);
  const [forfeit, setForfeit] = useState(false);

  useEffect(() => {
    setName(p?.full_name ?? '');
    setWa(p?.whatsapp_opt_in !== false);
    setSms(p?.sms_opt_in !== false);
  }, [p?.full_name, p?.whatsapp_opt_in, p?.sms_opt_in]);

  if (!user) return null;

  const save = async (patch: Record<string, unknown>, done: string) => {
    setBusy(true);
    const { error } = await db.from('profiles').update(patch).eq('id', user.id);
    setBusy(false);
    if (error) return toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
    await refreshProfile();
    toast({ title: done });
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await db.rpc('delete_my_account', { p_confirm: confirm.trim(), p_forfeit_wallet: forfeit });
    setBusy(false);
    if (error) {
      if (/wallet still has/i.test(error.message)) { setWalletNote(error.message); return; }
      return toast({ title: 'Account not deleted', description: error.message, variant: 'destructive' });
    }
    setDeleting(false);
    await signOut().catch(() => {});
    toast({ title: 'Your account has been deleted' });
    navigate('/');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
      <Panel>
        <PanelHeader eyebrow="You" title="Your details" />
        <div className="space-y-4">
          <div>
            <Label htmlFor="st-name">Your name</Label>
            <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone number</Label>
            <p className="m-0 font-semibold">{p?.phone || 'Not set'}</p>
            <p className="text-xs text-muted-foreground">You sign in with this number. To use a different one, contact support.</p>
          </div>
          <div>
            <Label>Time zone</Label>
            <p className="m-0 font-semibold">{(p?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone).replace(/_/g, ' ')}</p>
            <p className="text-xs text-muted-foreground">Taken from this device. Times in messages use it.</p>
          </div>
          <Button disabled={busy || !name.trim() || name.trim() === p?.full_name} onClick={() => save({ full_name: name.trim() }, 'Name saved')}>Save</Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Messages" title="How we reach you" />
        <p className="mb-2 text-sm text-muted-foreground">Booking confirmations, the link to your session and reminders 24 hours and 1 hour before.</p>
        <div className="divide-y divide-line">
          <label className="flex items-center justify-between gap-4 py-3">
            <span><span className="block font-semibold">WhatsApp</span><span className="text-sm text-muted-foreground">Our first choice</span></span>
            <Switch checked={wa} disabled={busy} onCheckedChange={(v) => { setWa(v); save({ whatsapp_opt_in: v }, v ? 'WhatsApp messages on' : 'WhatsApp messages off'); }} />
          </label>
          <label className="flex items-center justify-between gap-4 py-3">
            <span><span className="block font-semibold">SMS</span><span className="text-sm text-muted-foreground">When WhatsApp is off or fails</span></span>
            <Switch checked={sms} disabled={busy} onCheckedChange={(v) => { setSms(v); save({ sms_opt_in: v }, v ? 'SMS on' : 'SMS off'); }} />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign-in codes are always sent by SMS. To change your PIN, sign out and choose “Forgot PIN” when you sign in again.
        </p>
      </Panel>

      <Panel className="lg:col-span-2">
        <PanelHeader eyebrow="Leaving" title="Delete my account" />
        <p className="mb-4 max-w-[70ch] text-muted-foreground">
          We remove your name, phone number, photo and sign-in, and you are signed out everywhere. Records of payments and past
          consultations are kept without your details, because the law and the other person need them. Upcoming consultations
          must be cancelled first, and Babalawos must withdraw their earnings.
        </p>
        <Button variant="destructive" onClick={() => { setDeleting(true); setConfirm(''); setWalletNote(null); setForfeit(false); }}>Delete my account</Button>
      </Panel>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This can't be undone. Type DELETE to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
          {walletNote && (
            <label className="flex items-start gap-2 rounded-field bg-cloth p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} />
              <span>{walletNote} I understand this money will be lost.</span>
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>Keep my account</Button>
            <Button variant="destructive" disabled={busy || confirm.trim() !== 'DELETE' || (!!walletNote && !forfeit)} onClick={remove}>
              {busy ? 'Deleting…' : 'Delete for good'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
