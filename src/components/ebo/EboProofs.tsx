import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, AlertTriangle, HelpCircle } from "lucide-react";
import { eboApi, type EboProof } from "@/lib/ebo";

/** The ritual video (compressed for playback) and any photos, with what we heard in the audio. */
const EboProofs: React.FC<{ eboId: string; showCheck?: boolean; forClient?: boolean }> = ({ eboId, showCheck = true, forClient = false }) => {
  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ["ebo-proofs", eboId],
    queryFn: () => eboApi.proofs(eboId),
    // poll while a video is still being compressed
    refetchInterval: (q) => ((q.state.data as EboProof[] | undefined)?.some((p) => p.status === "processing") ? 15_000 : false),
  });
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!proofs.length) return null;
  return (
    <div className="space-y-3">
      {proofs.map((p) => (
        <div key={p.id} className="space-y-1">
          {p.status === "processing" && (
            <p className="text-sm text-gray-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Video uploaded. Preparing it for playback…</p>
          )}
          {p.status === "failed" && <p className="text-sm text-red-700">This video could not be processed. The Babalawo has been asked to upload it again.</p>}
          {p.status === "ready" && p.kind === "video" && p.url && (
            <video src={p.url} controls playsInline preload="metadata" className="w-full max-h-[60vh] rounded-xl bg-black" />
          )}
          {p.status === "ready" && p.kind === "photo" && p.url && (
            <img src={p.url} alt="Ebo proof" className="w-full max-h-[50vh] object-contain rounded-xl bg-gray-50" />
          )}
          {showCheck && p.kind === "video" && p.check && !p.check.skipped && (
            <ul className="text-xs text-gray-600 space-y-0.5">
              <li className="flex items-center gap-1">
                {p.check.name_heard ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <HelpCircle className="h-3.5 w-3.5 text-amber-600" />}
                {p.check.name_heard
                  ? `${forClient ? "Your" : "The client's"} name was heard in the prayers`
                  : `We could not pick out ${forClient ? "your" : "the client's"} name. Listen to check.`}
              </li>
              {!!p.check.items_heard?.length && (
                <li className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Items heard: {p.check.items_heard.join(", ")}</li>
              )}
              {!!p.check.items_missing?.length && (
                <li className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />Not heard: {p.check.items_missing.join(", ")}</li>
              )}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

export default EboProofs;
