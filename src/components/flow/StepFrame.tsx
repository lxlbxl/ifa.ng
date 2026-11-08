import { ArrowLeft, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * One step of a one-question-per-screen flow: back, progress, a big
 * question, and the tappable answers. Full screen on phones, a tall card on
 * larger screens.
 */
export function StepFrame({
  stepKey, progress, title, subtitle, onBack, onClose, top, children, footer, className,
}: {
  stepKey: string;
  /** 0..1 */
  progress?: number;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  /** Small context row above the question (e.g. the Babalawo being booked). */
  top?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-full flex-col', className)}>
      <div className="flex items-center gap-2 px-4 pt-3 sm:px-6 sm:pt-5">
        {onBack ? (
          <button type="button" onClick={onBack} className="grid h-12 w-12 place-items-center rounded-full hover:bg-line" aria-label="Back">
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : <span className="h-12 w-12" />}
        <div className="mx-2 h-2 flex-1 overflow-hidden rounded-pill bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label="Progress">
          <motion.div className="h-full rounded-pill bg-green-700" initial={false}
            animate={{ width: `${Math.max(4, Math.round((progress ?? 0) * 100))}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-full hover:bg-line" aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        ) : <span className="h-12 w-12" />}
      </div>

      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="flex flex-1 flex-col px-5 pb-6 pt-4 sm:px-8"
      >
        {top && <div className="mb-5">{top}</div>}
        <h2 className="font-display text-[clamp(30px,7.5vw,44px)] font-extrabold leading-[0.98] tracking-[-0.035em]">{title}</h2>
        {subtitle && <p className="mt-3 text-[17px] text-muted-foreground">{subtitle}</p>}
        <div className="mt-7 flex-1">{children}</div>
        {footer && <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-cloth via-cloth to-transparent px-5 pb-safe pt-4 sm:-mx-8 sm:px-8">{footer}</div>}
      </motion.div>
    </div>
  );
}

/** Big tappable option card. */
export function ChoiceCard({
  icon, title, body, color, onClick, disabled, selected, badge, testId,
}: {
  icon?: React.ReactNode; title: React.ReactNode; body?: React.ReactNode; color?: string;
  onClick: () => void; disabled?: boolean; selected?: boolean; badge?: React.ReactNode; testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-testid={testId}
      className={cn(
        'group relative flex w-full items-start gap-4 rounded-[24px] border-2 border-ink p-5 text-left text-ink transition-[transform,box-shadow] duration-150',
        'hover:-translate-y-0.5 hover:shadow-sticker active:translate-y-0 active:shadow-none',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:border-line disabled:text-muted-foreground disabled:hover:translate-y-0 disabled:hover:shadow-none',
        selected && 'shadow-sticker',
      )}
      style={{ backgroundColor: disabled ? '#efe9da' : color ?? '#fffdf7' }}
    >
      {icon && (
        <span className={cn('grid h-12 w-12 flex-none place-items-center rounded-full bg-paper/80 [&_svg]:h-6 [&_svg]:w-6',
          disabled && 'bg-paper/50')}>{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{title}</span>
        {body && <span className="mt-1 block text-[15px] leading-snug opacity-80">{body}</span>}
      </span>
      {badge && <span className="absolute right-3 top-3">{badge}</span>}
    </button>
  );
}
