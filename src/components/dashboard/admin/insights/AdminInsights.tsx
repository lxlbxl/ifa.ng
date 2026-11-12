import React, { useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InsightCard, InsightGrid, InsightPeriodPicker, percentChange, type InsightPeriod } from '@/components/brand';
import { useAdminInsights, type InsightMetric } from '@/hooks/useAdminInsights';
import { SECTION_INSIGHTS, formatInsight, type InsightSection, type InsightSpec } from './sectionInsights';

const POINT_FORMATS = new Set(['percent', 'rating']);

function cardProps(spec: InsightSpec, metric: InsightMetric | undefined, days: number) {
  const raw = metric?.value ?? null;
  const n = raw == null ? null : Number(raw);
  const empty = raw == null || raw === '' || n === 0;
  const isPeriod = metric != null && 'prev' in metric;
  const prev = metric?.prev == null ? null : Number(metric.prev);

  let delta: number | null = null;
  if (isPeriod && n != null && Number.isFinite(n) && prev != null) {
    delta = POINT_FORMATS.has(spec.format) ? n - prev : percentChange(n, prev);
  }
  const tone = spec.tone === 'coral' && empty ? 'paper' : spec.tone;
  const hint = empty && spec.emptyHint ? spec.emptyHint
    : spec.hint ?? (isPeriod && delta == null ? `Last ${days} days` : undefined);

  return {
    value: formatInsight(raw, spec.format),
    tone,
    delta,
    deltaUnit: POINT_FORMATS.has(spec.format) ? ('pts' as const) : ('%' as const),
    deltaLabel: `vs prev ${days}d`,
    invertDelta: spec.invert,
    hint: delta != null && !spec.hint ? undefined : hint,
    spark: metric?.spark ?? undefined,
  };
}

interface AdminInsightsProps {
  section: InsightSection;
  days: InsightPeriod;
  onDaysChange: (days: InsightPeriod) => void;
}

/** Insight cards for one admin page, with the period picker. */
const AdminInsights: React.FC<AdminInsightsProps> = ({ section, days, onDaysChange }) => {
  const specs = SECTION_INSIGHTS[section];
  const { data, isLoading, isError, refetch, isFetching } = useAdminInsights(section, days);
  // Phones show the first four cards so the page itself stays close to the top.
  const [expanded, setExpanded] = useState(false);
  const PHONE_LIMIT = 4;
  const collapsible = specs.length > PHONE_LIMIT;

  return (
    <section aria-label="Insights" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow text-muted-foreground">Insights · last {days} days</p>
        <InsightPeriodPicker value={days} onChange={onDaysChange} />
      </div>
      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-panel border border-line bg-paper p-4 text-sm">
          <span>Insights could not load just now.</span>
          <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-1.5 rounded-pill border border-ink/20 px-3 py-1.5 font-bold">
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Try again
          </button>
        </div>
      ) : (
        <InsightGrid>
          {specs.map((spec, i) => (
            <InsightCard
              key={spec.key}
              className={cn(
                // An odd number of cards leaves a gap on phones, so the headline card goes full width.
                i === 0 && specs.length % 2 === 1 && 'sm:col-span-2 xl:col-span-1',
                i === 0 && specs.length % 2 === 1 && (expanded || !collapsible) && 'max-sm:col-span-2',
                collapsible && !expanded && i >= PHONE_LIMIT && 'hidden sm:flex',
              )}
              label={spec.label}
              loading={isLoading}
              {...cardProps(spec, data?.metrics?.[spec.key], days)}
            />
          ))}
        </InsightGrid>
      )}
      {collapsible && !isError && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-pill border border-line bg-paper text-sm font-bold sm:hidden"
        >
          {expanded ? 'Show fewer' : `Show all ${specs.length} insights`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </section>
  );
};

export default AdminInsights;
