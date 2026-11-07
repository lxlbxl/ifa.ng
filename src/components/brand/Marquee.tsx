import { cn } from '@/lib/utils';

interface MarqueeProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isClone: boolean) => React.ReactNode;
  /** rtl scrolls right-to-left (cards); ltr is used by the Odù ticker. */
  direction?: 'rtl' | 'ltr';
  /** Seconds for one full loop. */
  duration?: number;
  gap?: number;
  className?: string;
  trackClassName?: string;
  label?: string;
}

/**
 * Infinite horizontal loop. Items render twice; the second copy is hidden from
 * screen readers and keyboard. Pauses on hover and focus, and stops for
 * prefers-reduced-motion (see index.css).
 */
export function Marquee<T>({
  items,
  renderItem,
  direction = 'rtl',
  duration = 46,
  gap = 22,
  className,
  trackClassName,
  label,
}: MarqueeProps<T>) {
  return (
    <div className={cn('marquee overflow-hidden', className)} aria-label={label} role={label ? 'region' : undefined}>
      <div
        className={cn(
          'marquee-track flex w-max',
          direction === 'rtl' ? 'animate-marquee-rtl' : 'animate-marquee-ltr',
          trackClassName,
        )}
        style={{ gap, ['--marquee-gap' as string]: `${gap / 2}px`, animationDuration: `${duration}s` }}
      >
        {items.map((item, i) => renderItem(item, i, false))}
        {items.map((item, i) => (
          <div key={`clone-${i}`} aria-hidden="true" className="contents">
            {renderItem(item, i, true)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Marquee;
