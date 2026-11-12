import React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/dashboard/shell/Panel";
import { useBabalawoOnboarding, type Onboarding } from "@/hooks/useBabalawoOnboarding";
import { cn } from "@/lib/utils";

type Step = { key: keyof Onboarding; title: string; why: string; cta: string; go: string; needed: boolean };

const STEPS: Step[] = [
  { key: "photo", title: "Add a clear photo of yourself", why: "Clients choose a Babalawo they can see.", cta: "Add photo", go: "profile", needed: true },
  { key: "price", title: "Set your consultation price", why: "Within the platform's lowest and highest price.", cta: "Set price", go: "pricing", needed: true },
  { key: "hours", title: "Open your weekly hours", why: "Clients can only book times you open.", cta: "Set hours", go: "availability", needed: true },
  { key: "bio", title: "Write a few lines about your practice", why: "Your lineage, how long you have practised, what you help with.", cta: "Write about you", go: "profile", needed: false },
  { key: "google_email", title: "Add the Google email you use for Meet", why: "Makes you co-host of your calls, so you can admit, mute and record.", cta: "Add email", go: "profile", needed: false },
  { key: "bank", title: "Add your bank account", why: "Needed to withdraw your earnings.", cta: "Add bank", go: "bank", needed: false },
];

const go = (where: string) => {
  if (where === "bank") window.dispatchEvent(new CustomEvent("openBankDetailsModal"));
  else window.dispatchEvent(new CustomEvent("ifa:navigate", { detail: where }));
};

/** On the Babalawo's home page until every step is done. */
const OnboardingChecklist: React.FC = () => {
  const { data } = useBabalawoOnboarding();
  if (!data) return null;
  const todo = STEPS.filter((s) => !data[s.key]);
  if (todo.length === 0 && data.listed) return null;
  const done = STEPS.length - todo.length;
  const missingNeeded = todo.some((s) => s.needed);

  return (
    <Panel className={cn(missingNeeded && "border-2 border-ink")} data-testid="onboarding-checklist">
      <PanelHeader
        eyebrow={`${done} of ${STEPS.length} done`}
        title={missingNeeded ? "Clients can't find you yet" : !data.verified ? "Waiting for our team to verify you" : "Finish setting up"}
      />
      <p className="-mt-2 mb-4 text-muted-foreground">
        {missingNeeded
          ? "Your profile shows in search and can be booked once the first three steps are done."
          : !data.verified
            ? "Your profile is ready. We will let you know as soon as it is verified."
            : "You can take bookings. These help you get paid and run your calls smoothly."}
      </p>
      <ul className="divide-y divide-line">
        {STEPS.map((s) => {
          const ok = data[s.key];
          return (
            <li key={s.key} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border-2",
                ok ? "border-ink bg-leaf" : "border-line bg-paper")} aria-hidden="true">
                {ok && <Check className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold", ok && "text-muted-foreground line-through")}>
                  {s.title}{s.needed && !ok && <span className="ml-2 text-xs font-bold uppercase tracking-[0.1em] text-camwood">Needed</span>}
                </p>
                {!ok && <p className="text-sm text-muted-foreground">{s.why}</p>}
              </div>
              {!ok && <Button size="sm" variant={s.needed ? "default" : "outline"} onClick={() => go(s.go)}>{s.cta}</Button>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

export default OnboardingChecklist;
