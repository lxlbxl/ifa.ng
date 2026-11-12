import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { readBrowserChoices, saveBrowserChoices } from '@/lib/privacy';

/** Opens the notice again, e.g. from "Privacy choices" in the footer. */
export const openPrivacyChoices = () => window.dispatchEvent(new CustomEvent('ifa:open-privacy-choices'));

/**
 * Cookie and storage notice (NDPA/GAID, GDPR with the ePrivacy rules, UK PECR).
 * IFA.ng sets no advertising or analytics cookies, so nothing optional runs that needs a "yes" first.
 * The notice says what is stored, links the cookie policy, and lets the visitor turn crash reports off.
 */
export function CookieNotice() {
  const [open, setOpen] = useState(() => readBrowserChoices() === null);
  const [details, setDetails] = useState(false);
  const [errors, setErrors] = useState(() => readBrowserChoices()?.errorReports !== false);

  useEffect(() => {
    const show = () => { setErrors(readBrowserChoices()?.errorReports !== false); setDetails(true); setOpen(true); };
    window.addEventListener('ifa:open-privacy-choices', show);
    return () => window.removeEventListener('ifa:open-privacy-choices', show);
  }, []);

  if (!open) return null;
  const save = (errorReports: boolean) => { saveBrowserChoices({ errorReports }); setOpen(false); };

  return (
    <div role="region" aria-label="Cookies and privacy"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-[640px] rounded-[20px] border-2 border-ink bg-paper p-4 text-ink shadow-sticker md:bottom-5 md:p-5">
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-camwood" aria-hidden />
        <div className="min-w-0 text-[14px] leading-snug">
          <p className="m-0 font-bold">We only use what keeps IFA.ng working.</p>
          <p className="m-0 mt-1 text-muted-foreground">
            A sign-in cookie, and settings saved in this browser. No advertising or tracking cookies. If something breaks, we may
            receive a crash report (no cookies, no account details). <Link to="/cookies" className="underline">Cookie policy</Link>
          </p>
          {details && (
            <label className="mt-3 flex items-center justify-between gap-4 rounded-field bg-cloth px-3 py-2.5">
              <span><span className="block font-semibold">Crash reports</span><span className="text-xs text-muted-foreground">Help us fix errors</span></span>
              <Switch checked={errors} onCheckedChange={setErrors} aria-label="Crash reports" />
            </label>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {details ? (
          <Button size="sm" variant="sun" onClick={() => save(errors)}>Save choices</Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setDetails(true)}>Choices</Button>
            <Button size="sm" variant="sun" onClick={() => save(true)} data-testid="cookie-ok">OK</Button>
          </>
        )}
      </div>
    </div>
  );
}
