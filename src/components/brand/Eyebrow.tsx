import { cn } from '@/lib/utils';

/** Small uppercase label that sits above a display heading. */
export const Eyebrow = ({ className, children, ...rest }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('eyebrow inline-block', className)} {...rest}>
    {children}
  </span>
);

interface SectionHeadingProps {
  eyebrow?: React.ReactNode;
  eyebrowClassName?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  size?: 'lg' | 'md' | 'sm';
  /** "split" puts the lede to the right of the title on wide screens, like the homepage. */
  layout?: 'stack' | 'split';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

const titleSize = { lg: 'text-display-lg', md: 'text-display-md', sm: 'text-display-sm' };

/** Eyebrow + big Bricolage heading + optional lede. Use one per section. */
export const SectionHeading = ({
  eyebrow,
  eyebrowClassName,
  title,
  lede,
  size = 'md',
  layout = 'stack',
  as: Tag = 'h2',
  className,
}: SectionHeadingProps) => (
  <div
    className={cn(
      layout === 'split' ? 'flex flex-wrap items-end justify-between gap-5' : 'flex flex-col gap-3',
      className,
    )}
  >
    <div>
      {eyebrow && <Eyebrow className={cn('mb-3 text-camwood', eyebrowClassName)}>{eyebrow}</Eyebrow>}
      <Tag className={cn('font-display font-extrabold', titleSize[size])}>{title}</Tag>
    </div>
    {lede && <p className={cn('m-0 text-lg text-muted-foreground', layout === 'split' ? 'max-w-[400px] text-base' : 'max-w-[52ch]')}>{lede}</p>}
  </div>
);

export default SectionHeading;
