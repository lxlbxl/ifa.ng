import { useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Video, ShieldCheck, ExternalLink, LifeBuoy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSessionById } from "@/hooks/useSessionById";
import { toast } from "@/hooks/use-toast";
import AgoraVideoRoom from "./AgoraVideoRoom";
import NetworkStatusBar from "./pwa/NetworkStatusBar";
import ConsentFields, { ConsentValue } from "./session/ConsentFields";
import { ensureMeetLink, getSessionConsents, recordSessionConsent, uploadSessionAudio, SessionConsentRow } from "@/services/videoService";

/**
 * Session entry point. Google Meet is the default; Agora (in-app) is the backup that is used
 * automatically if Meet cannot be created, or manually via "Having trouble?".
 */
const SessionVideoRoom = () => {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const qc = useQueryClient();
  const { data: session, isLoading, error } = useSessionById(sessionId || "");
  const [consents, setConsents] = useState<SessionConsentRow[] | null>(null);
  const [draft, setDraft] = useState<ConsentValue>({ recording: false, ai: false });
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const requested = useRef(false);

  const refreshConsents = () => getSessionConsents(sessionId!).then(setConsents).catch(() => setConsents([]));
  useEffect(() => { if (sessionId && user) refreshConsents(); }, [sessionId, user?.id]);

  // Make sure the Meet link exists (server refuses unless paid; idempotent).
  useEffect(() => {
    if (!session || requested.current || session.payment_status !== "paid") return;
    if (session.video_provider === "google_meet" && !session.meet_uri) {
      requested.current = true;
      setPreparing(true);
      ensureMeetLink(session.id)
        .catch((e) => console.error("ensureMeetLink", e))
        .finally(() => { setPreparing(false); qc.invalidateQueries({ queryKey: ["session", sessionId] }); });
    }
  }, [session?.id, session?.payment_status, session?.meet_uri]);

  if (isLoading || consents === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (error || !session || !sessionId) {
    return <div className="text-center mt-8 text-red-600">Session not found or you do not have access.</div>;
  }
  if (user && user.id !== session.user_id && user.id !== session.babalawo_id) return <Navigate to="/" replace />;

  const isBabalawo = user?.id === session.babalawo_id;
  const party = isBabalawo ? "babalawo" : "client";
  const mine = consents.find((c) => c.party === party);
  const other = consents.find((c) => c.party !== party);
  const bothAgreed = !!mine && !!other && [mine, other].every((c) => c.recording_consent && c.ai_processing_consent && !c.withdrawn_at);
  const leave = () => { window.location.href = "/dashboard"; };

  if (session.payment_status !== "paid") {
    return <Notice title="Payment pending" body="This consultation opens as soon as payment is confirmed." />;
  }
  if (useBackup || session.video_provider === "agora") {
    return (
      <div>
        <NetworkStatusBar audience={party === "babalawo" ? "babalawo" : "client"} context="joining" />
        {session.video_fallback_reason && !useBackup && (
          <p className="text-center text-xs text-muted-foreground p-2">Using backup video because Google Meet was unavailable.</p>
        )}
        <AgoraVideoRoom sessionId={sessionId} onLeave={leave} />
      </div>
    );
  }

  const saveConsent = async () => {
    setSaving(true);
    try {
      await recordSessionConsent(session.id, draft.recording, draft.ai);
      await refreshConsents();
      ensureMeetLink(session.id).catch(() => {}); // arm/disarm auto-recording on the Meet space
      toast({ title: "Your choice is saved" });
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Video className="h-5 w-5" /> Your consultation</h1>
        <NetworkStatusBar variant="card" audience={party === "babalawo" ? "babalawo" : "client"} context="joining" />

        {!mine ? (
          <>
            <ConsentFields value={draft} onChange={setDraft} role={party} />
            <Button className="w-full" onClick={saveConsent} disabled={saving}>
              {saving ? "Saving..." : draft.recording ? "Save my choice" : "Continue without recording"}
            </Button>
          </>
        ) : (
          <>
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              {bothAgreed
                ? "Both of you agreed: this consultation will be recorded and drafted into notes for your Babalawo to approve."
                : !other
                  ? `Waiting for ${isBabalawo ? "your client" : "your Babalawo"} to choose. Without both agreeing, nothing is recorded.`
                  : "This consultation will not be recorded."}
            </p>

            {preparing || !session.meet_uri ? (
              <Button className="w-full" disabled><Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparing your Google Meet room...</Button>
            ) : (
              <Button asChild className="w-full">
                <a href={session.meet_uri} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Join Google Meet</a>
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {isBabalawo
                ? "Join from a computer or the browser on your phone with your Google account. You are the co-host: admit your client when they ask to join. If recording does not start by itself, press Record in Meet."
                : "No Google account needed. Open the link, enter your name and tap \"Ask to join\"; your Babalawo will let you in."}
            </p>

            <button type="button" className="text-xs underline flex items-center gap-1 text-muted-foreground" onClick={() => setUseBackup(true)}>
              <LifeBuoy className="h-3 w-3" /> Having trouble? Use backup video here instead
            </button>

            {isBabalawo && session.recording_status === "unavailable" && (
              <label className="block text-xs border rounded-md p-3 space-y-2">
                <span className="flex items-center gap-1 font-medium"><Upload className="h-3 w-3" /> No recording was produced</span>
                <span className="block text-muted-foreground">If you recorded the audio yourself (both parties agreed), upload it and we will draft the notes.</span>
                <input type="file" accept="audio/*,video/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try { await uploadSessionAudio(session.id, f); toast({ title: "Uploaded", description: "Notes will be drafted shortly." }); }
                  catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
                }} />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="min-h-screen flex items-center justify-center p-4 text-center">
    <div><h1 className="text-lg font-semibold">{title}</h1><p className="text-sm text-muted-foreground mt-1">{body}</p></div>
  </div>
);

export default SessionVideoRoom;
