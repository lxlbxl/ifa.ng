import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InsightTone = 'paper' | 'leaf' | 'sun' | 'coral' | 'indigo' | 'ink';

const tones: Record<InsightTone, string> = {
  paper: 'bg-paper border border-line text-ink',
  leaf: 'bg-leaf text-ink',
  sun: 'bg-sun text-ink',
  coral: 'bg-[#f3b9a6] text-ink',
  indigo: 'bg-[#b9c4f2] text-ink',
  ink: 'bg-ink text-cloth',
};

/** Percentage change, or null when there is nothing to compare with. */
export function percentChange(value: number | null | undefined, prev: number | null | undefined): number | null {
  if (value == null || prev == null) return null;
  if (prev === 0) return value === 0 ? 0 : null;
  return ((value - prev) / Math.abs(prev)) * 100;
}

/** Tiny trend line drawn in the card's own text colour. */
export const Sparkline = ({ points, className }: { points: number[]; className?: string }) => {
  if (points.length < 2) return null;
  const w = 120;
  const h = 32;
  const max = Math.max(...points);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 2 - ((p - min) / span) * (h - 4)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-8 w-full overflow-visible', className)} aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="currentColor" opacity={0.08} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.7} />
      <circle cx={lx} cy={ly} r={2.6} fill="currentColor" />
    </svg>
  );
};

/** Up/down chip. `invert` when a fall is good news (refunds, disputes, wait times). */
export const DeltaChip = ({
  delta,
  invert,
  unit = '%',
  onDark,
}: {
  delta: number;
  invert?: boolean;
  unit?: '%' | 'pts';
  onDark?: boolean;
}) => {
  const flat = Math.abs(delta) < 0.5;
  const good = flat ? null : (delta > 0) !== Boolean(invert);
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const amount = Math.abs(delta) >= 100 ? Math.round(Math.abs(delta)).toLocaleString() : Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-xs font-extrabold tabular-nums',
        onDark ? 'bg-cloth/10' : 'bg-ink/[0.07]',
        good === true && (onDark ? 'text-leaf' : 'text-green-700'),
        good === false && (onDark ? 'text-coral-300' : 'text-coral-600'),
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {flat ? 'Flat' : `${amount}${unit === '%' ? '%' : ' pts'}`}
      <span className="sr-only">{flat ? '' : good ? ' (better)' : ' (worse)'}</span>
    </span>
  );
};

export interface InsightCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small line under the value, e.g. "Right now" or "₦2.4m last period". */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: InsightTone;
  /** Change against the previous period, already in percent (or points, see deltaUnit). */
  delta?: number | null;
  deltaUnit?: '%' | 'pts';
  /** Shown next to the chip, e.g. "vs previous 30 days". */
  deltaLabel?: React.ReactNode;
  /** A fall is good news for this metric. */
  invertDelta?: boolean;
  /** Trend points, oldest first. */
  spark?: number[];
  loading?: boolean;
  className?: string;
}

/**
 * KPI card for dashboards: label, big value, change against the previous period and a
 * small trend line. Same shape and tones as StatTile, so the two sit together in a grid.
 */
export const InsightCard = ({
  label,
  value,
  hint,
  icon,
  tone = 'paper',
  delta,
  deltaUnit = '%',
  deltaLabel,
  invertDelta,
  spark,
  loading,
  className,
}: InsightCardProps) => {
  if (loading) {
    return <div className={cn('h-[148px] animate-pulse rounded-panel bg-line/60', className)} aria-busy="true" />;
  }
  const onDark = tone === 'ink';
  const hasSpark = spark && spark.length > 1 && spark.some((p) => p !== 0);
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-panel p-4 sm:p-5', tones[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow leading-tight opacity-75">{label}</span>
        {icon && <span className="flex-none opacity-80 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
      </div>
      <span className="truncate font-display text-[clamp(26px,2.6vw,36px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </span>
      {(delta != null || deltaLabel || hint) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-tight">
          {delta != null && <DeltaChip delta={delta} invert={invertDelta} unit={deltaUnit} onDark={onDark} />}
          {delta != null && deltaLabel && <span className="opacity-70">{deltaLabel}</span>}
          {hint && <span className={cn('opacity-75', delta != null && 'max-sm:hidden')}>{hint}</span>}
        </div>
      )}
      {hasSpark && <Sparkline points={spark!} className="mt-auto" />}
    </div>
  );
};

/** Responsive grid for InsightCard / StatTile: 2 across on phones, up to 4 on desktop. */
export const InsightGrid = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4', className)}>{children}</div>
);

export const INSIGHT_PERIODS = [7, 30, 90] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

/** Pill switcher for the period the cards cover. */
export const InsightPeriodPicker = ({
  value,
  onChange,
  periods = INSIGHT_PERIODS,
  className,
}: {
  value: number;
  onChange: (days: InsightPeriod) => void;
  periods?: readonly InsightPeriod[];
  className?: string;
}) => (
  <div className={cn('inline-flex rounded-pill border border-line bg-paper p-1', className)} role="radiogroup" aria-label="Period">
    {periods.map((d) => (
      <button
        key={d}
        type="button"
        role="radio"
        aria-checked={value === d}
        onClick={() => onChange(d)}
        className={cn(
          'h-8 rounded-pill px-3 text-sm font-bold transition-colors',
          value === d ? 'bg-ink text-cloth' : 'text-ink/70 hover:text-ink',
        )}
      >
        {d}d
      </button>
    ))}
  </div>
);
