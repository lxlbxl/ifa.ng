import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js/min';
import { countryByCode, searchCountries, POPULAR } from '@/lib/countries';
import { cn } from '@/lib/utils';

/**
 * Country code button + full-screen searchable list. Typing filters live by
 * country name, ISO code or dial code; Enter picks the top match.
 */
export function CountryPicker({ value, onChange }: { value: CountryCode; onChange: (c: CountryCode) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const current = countryByCode(value);
  const results = useMemo(() => searchCountries(q), [q]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => input.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = (c: CountryCode) => { onChange(c); setOpen(false); };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-16 flex-none items-center gap-2 rounded-field border-2 border-ink bg-paper px-3.5 text-lg font-bold transition-colors hover:bg-cloth focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        aria-label={`Country code: ${current?.name ?? value} +${current?.dial ?? ''}. Change`}
        data-testid="country-button"
      >
        <span className="text-2xl leading-none" aria-hidden="true">{current?.flag}</span>
        <span>+{current?.dial}</span>
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-cloth sm:items-center sm:bg-ink/50 sm:p-6" role="dialog" aria-modal="true" aria-label="Choose your country">
          <div className="flex h-full w-full flex-col bg-cloth sm:h-auto sm:max-h-[80vh] sm:max-w-md sm:rounded-panel sm:border-2 sm:border-ink sm:shadow-sticker-lg">
            <div className="flex items-center gap-2 border-b border-line p-3">
              <label className="flex h-14 flex-1 items-center gap-2 rounded-field border-2 border-ink bg-paper px-3">
                <Search className="h-5 w-5 flex-none opacity-60" aria-hidden="true" />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0].code); }}
                  placeholder="Search country or code"
                  className="h-full w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                  autoComplete="off"
                  inputMode="search"
                  aria-label="Search country or code"
                />
              </label>
              <button type="button" onClick={() => setOpen(false)} className="grid h-14 w-14 place-items-center rounded-full hover:bg-line" aria-label="Close">
                <X className="h-6 w-6" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto overscroll-contain p-2" role="listbox" aria-label="Countries">
              {results.length === 0 && <li className="p-6 text-center text-muted-foreground">No country matches “{q}”.</li>}
              {results.map((c, i) => (
                <li key={c.code}>
                  {!q && i === POPULAR.length && <div className="mx-3 my-2 border-t border-line" aria-hidden="true" />}
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === value}
                    onClick={() => pick(c.code)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-field px-3 py-3.5 text-left text-[17px] hover:bg-paper',
                      c.code === value && 'bg-leaf/50 font-bold',
                    )}
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">{c.flag}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="font-semibold text-muted-foreground">+{c.dial}</span>
                    {c.code === value && <Check className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
