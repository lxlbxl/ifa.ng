import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Panel, PanelHeader } from "@/components/dashboard/shell/Panel";
import { ONBOARDING_KEY } from "@/hooks/useBabalawoOnboarding";
import BabalawoAvatarUploader from "./BabalawoAvatarUploader";

const db = supabase as any;
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How clients see the Babalawo: photo, name, about, languages, specialties, and the Google email for Meet. */
const BabalawoProfileSettings: React.FC = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const { data: bab } = useQuery({
    queryKey: ["bab-profile", user?.id], enabled: !!user?.id,
    queryFn: async () => (await db.from("babalawos").select("bio, specialties, languages, experience_years, city, country, google_email, profile_picture_url").eq("user_id", user!.id).maybeSingle()).data,
  });
  const [f, setF] = useState({ full_name: "", bio: "", specialties: "", languages: "", experience_years: "", city: "", country: "", google_email: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bab) return;
    setF({
      full_name: userProfile?.full_name ?? "",
      bio: bab.bio ?? "",
      specialties: (bab.specialties ?? []).join(", "),
      languages: (bab.languages ?? []).join(", "),
      experience_years: bab.experience_years != null ? String(bab.experience_years) : "",
      city: bab.city ?? "", country: bab.country ?? "",
      google_email: bab.google_email ?? "",
    });
    setAvatar(bab.profile_picture_url || userProfile?.avatar_url || null);
  }, [bab, userProfile?.full_name, userProfile?.avatar_url]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bab-profile", user?.id] });
    qc.invalidateQueries({ queryKey: [ONBOARDING_KEY] });
  };

  const onAvatar = async (url: string) => {
    // The upload saved it as the account photo; the public profile uses the same picture.
    await db.from("babalawos").update({ profile_picture_url: url }).eq("user_id", user!.id);
    setAvatar(url);
    refresh();
    await refreshProfile();
    toast({ title: "Photo updated" });
  };

  const save = async () => {
    const email = f.google_email.trim();
    if (email && !EMAIL.test(email)) return toast({ title: "Check the Google email", description: "It should look like name@gmail.com.", variant: "destructive" });
    if (!f.full_name.trim()) return toast({ title: "Add your name", variant: "destructive" });
    const years = f.experience_years === "" ? null : Math.max(0, Math.min(80, Math.round(Number(f.experience_years))));
    setBusy(true);
    const [a, b] = await Promise.all([
      db.from("profiles").update({ full_name: f.full_name.trim() }).eq("id", user!.id),
      db.from("babalawos").update({
        bio: f.bio.trim() || null, specialties: list(f.specialties), languages: list(f.languages),
        experience_years: Number.isFinite(years as number) ? years : null,
        city: f.city.trim() || null, country: f.country.trim() || null, google_email: email || null,
      }).eq("user_id", user!.id),
    ]);
    setBusy(false);
    const error = a.error || b.error;
    if (error) return toast({ title: "Profile not saved", description: error.message, variant: "destructive" });
    refresh();
    await refreshProfile();
    toast({ title: "Profile saved", description: "Clients see the changes straight away." });
  };

  if (!user) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      <Panel>
        <PanelHeader eyebrow="Shown to clients" title="About you" />
        <BabalawoAvatarUploader userId={user.id} fullName={f.full_name || "B"} avatarUrl={avatar} onAvatarUploaded={onAvatar} />
        <div className="space-y-4">
          <div><Label htmlFor="bp-name">Name clients see</Label><Input id="bp-name" value={f.full_name} onChange={set("full_name")} placeholder="Babalawo Ifágbèmí Adéyẹmí" /></div>
          <div>
            <Label htmlFor="bp-bio">About your practice</Label>
            <Textarea id="bp-bio" rows={6} value={f.bio} onChange={set("bio")}
              placeholder="Your lineage and where you trained, how long you have practised, and what clients come to you for." />
            <p className="mt-1 text-xs text-muted-foreground">{f.bio.trim().length < 40 ? `A few more words, please (${f.bio.trim().length}/40).` : "Looks good."}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="bp-years">Years of practice</Label><Input id="bp-years" type="number" inputMode="numeric" min={0} value={f.experience_years} onChange={set("experience_years")} /></div>
            <div><Label htmlFor="bp-lang">Languages</Label><Input id="bp-lang" value={f.languages} onChange={set("languages")} placeholder="Yorùbá, English" /></div>
          </div>
          <div><Label htmlFor="bp-spec">What you help with</Label><Input id="bp-spec" value={f.specialties} onChange={set("specialties")} placeholder="Ifá divination, Orí, family, business" />
            <p className="mt-1 text-xs text-muted-foreground">Separate with commas.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="bp-city">City</Label><Input id="bp-city" value={f.city} onChange={set("city")} /></div>
            <div><Label htmlFor="bp-country">Country</Label><Input id="bp-country" value={f.country} onChange={set("country")} /></div>
          </div>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel tone="cloth">
          <PanelHeader eyebrow="For your video calls" title="Google email" />
          <p className="mb-3 text-sm text-muted-foreground">
            The Gmail or Google Workspace address you use on your phone or laptop. We add it as co-host of each consultation's Google Meet,
            so you can admit, mute and record. Clients never see it.
          </p>
          <Label htmlFor="bp-google">Google email</Label>
          <Input id="bp-google" type="email" inputMode="email" autoComplete="email" value={f.google_email} onChange={set("google_email")} placeholder="name@gmail.com" />
          <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline" href="https://accounts.google.com/signup" target="_blank" rel="noreferrer">
            No Google account? Create one free <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Panel>
        <Button size="lg" className="w-full" onClick={save} disabled={busy} data-testid="save-profile">{busy ? "Saving…" : "Save profile"}</Button>
      </div>
    </div>
  );
};

export default BabalawoProfileSettings;
