import { cn } from '@/lib/utils';
import { pastelBlocks } from '@/design/tokens';

/**
 * Paper panel with a 2px ink border and a hard offset shadow, like a sticker.
 * Use it for the one thing on a screen you want to stand out: session notes,
 * a booking summary, a receipt.
 */
export const StickerPanel = ({
  className,
  tilt,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tilt?: boolean }) => (
  <div
    className={cn(
      'rounded-panel border-2 border-ink bg-paper p-5 shadow-sticker-lg',
      tilt && 'rotate-[1.2deg]',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

/**
 * Pastel colour block with a big number. Used for steps on the homepage and
 * for KPI tiles in the dashboards. `index` picks the colour from pastelBlocks.
 */
export const ColorBlock = ({
  index = 0,
  color,
  number,
  title,
  className,
  children,
}: {
  index?: number;
  color?: string;
  number?: React.ReactNode;
  title?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) => (
  <div
    className={cn('flex flex-col gap-3 rounded-[28px] p-6 text-ink sm:min-h-[220px]', className)}
    style={{ backgroundColor: color ?? pastelBlocks[index % pastelBlocks.length] }}
  >
    {number !== undefined && (
      <span className="font-display text-[56px] font-extrabold leading-none tracking-[-0.04em]">{number}</span>
    )}
    {title && <h3 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{title}</h3>}
    {children}
  </div>
);

/**
 * Compact KPI tile: label, big value, optional hint. `tone` picks a pastel
 * block or plain paper. Shared by admin and the Babalawo/client dashboards.
 */
export const StatTile = ({
  label,
  value,
  hint,
  icon,
  tone = 'paper',
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'paper' | 'leaf' | 'sun' | 'coral' | 'indigo' | 'ink';
  className?: string;
}) => {
  const tones = {
    paper: 'bg-paper border border-line text-ink',
    leaf: 'bg-leaf text-ink',
    sun: 'bg-sun text-ink',
    coral: 'bg-[#f3b9a6] text-ink',
    indigo: 'bg-[#b9c4f2] text-ink',
    ink: 'bg-ink text-cloth',
  };
  return (
    <div className={cn('flex flex-col gap-2 rounded-panel p-5', tones[tone], className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow opacity-75">{label}</span>
        {icon && <span className="opacity-80 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
      </div>
      <span className="font-display text-[clamp(28px,3vw,40px)] font-extrabold leading-none tracking-[-0.03em]">
        {value}
      </span>
      {hint && <span className="text-sm opacity-75">{hint}</span>}
    </div>
  );
};

/** Animated five-bar sound wave, used on "now playing" chips and live sessions. */
export const SoundWave = ({ className }: { className?: string }) => (
  <span className={cn('flex h-5 items-center gap-[3px]', className)} aria-hidden="true">
    {[0, 0.15, 0.3, 0.45, 0.6].map((d) => (
      <i key={d} className="w-[3px] animate-wave-bar rounded-sm bg-leaf" style={{ animationDelay: `${d}s` }} />
    ))}
  </span>
);

/** Numbered leaf dot used in tick lists. */
export const TickDot = ({ children }: { children: React.ReactNode }) => (
  <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-leaf text-sm font-extrabold text-ink">
    {children}
  </span>
);
