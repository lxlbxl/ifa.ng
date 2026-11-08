import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface ConsentValue { recording: boolean; ai: boolean }

/**
 * Explicit, opt-in consent. Nothing is pre-ticked. A recording only happens when BOTH the
 * client and the Babalawo tick both boxes; otherwise the consultation is not recorded.
 */
const ConsentFields: React.FC<{ value: ConsentValue; onChange: (v: ConsentValue) => void; role: "client" | "babalawo" }> = ({ value, onChange, role }) => (
  <fieldset className="rounded-md border p-3 space-y-3 text-sm">
    <legend className="px-1 font-medium">Recording &amp; AI notes (optional)</legend>
    <p className="text-muted-foreground text-xs">
      Your consultation is private. If both you and {role === "client" ? "your Babalawo" : "your client"} agree, Google Meet records the
      session and our AI turns it into draft notes in English or Yorùbá. The Babalawo reviews and approves the notes before
      anything is shared. Recordings are kept in restricted storage, visible only to the Babalawo and IFA.ng administrators,
      and deleted automatically after the retention period. You can change your choice until the session starts.
    </p>
    <div className="flex items-start gap-2">
      <Checkbox id="consent-rec" checked={value.recording}
        onCheckedChange={(c) => onChange({ recording: c === true, ai: c === true ? value.ai : false })} />
      <Label htmlFor="consent-rec" className="leading-snug">I agree to this consultation being audio/video recorded.</Label>
    </div>
    <div className="flex items-start gap-2">
      <Checkbox id="consent-ai" checked={value.ai} disabled={!value.recording}
        onCheckedChange={(c) => onChange({ ...value, ai: c === true })} />
      <Label htmlFor="consent-ai" className="leading-snug">I agree to the recording being transcribed and summarised by AI to draft consultation notes.</Label>
    </div>
  </fieldset>
);

export default ConsentFields;
