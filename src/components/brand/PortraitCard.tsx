import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { pickBlock } from '@/design/tokens';

export interface PortraitCardProps {
  name: string;
  imageUrl?: string | null;
  /** Small white chips under the name: city, languages, fee. */
  chips?: React.ReactNode[];
  /** Shows the "Available today" ink pill in the corner. */
  status?: 'available' | 'busy' | 'offline' | null;
  /** Background colour block. Defaults to a stable colour picked from the name. */
  color?: string;
  to?: string;
  onClick?: () => void;
  /** Tilt alternates -2° / +2° like trading cards. Off for grids. */
  tilt?: 'left' | 'right' | 'none';
  size?: 'md' | 'sm';
  tabIndex?: number;
  className?: string;
  children?: React.ReactNode;
}

const statusLabel = { available: 'Available today', busy: 'In a session', offline: null };

/**
 * The signature IFA.ng card: a saturated colour block, a portrait that fades
 * into it, a big Bricolage name and white chips. Used in the homepage marquee,
 * search results and anywhere a Babalawo is picked.
 */
export const PortraitCard = ({
  name,
  imageUrl,
  chips = [],
  status,
  color,
  to,
  onClick,
  tilt = 'none',
  size = 'md',
  tabIndex,
  className,
  children,
}: PortraitCardProps) => {
  const bg = color ?? pickBlock(name);
  const label = status ? statusLabel[status] : null;
  const initials = name
    .replace(/^(Baba|Iya|Ìyá|Chief|Dr\.?)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase();

  const body = (
    <>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 z-[1] h-full w-full object-cover [mask-image:linear-gradient(180deg,#000_55%,transparent_92%)] [object-position:center_20%]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-[12%] z-[1] text-center font-display text-[120px] font-extrabold leading-none text-white/25"
        >
          {initials}
        </span>
      )}
      {label && (
        <span className="absolute left-3.5 top-3.5 z-[2] inline-flex items-center gap-1.5 rounded-pill bg-ink px-3 py-1.5 text-[11px] font-bold text-white">
          <span className={cn('h-[7px] w-[7px] rounded-full', status === 'available' ? 'bg-leaf' : 'bg-sun')} />
          {label}
        </span>
      )}
      <span className="absolute inset-x-[18px] bottom-[18px] z-[2] block">
        <span
          className={cn(
            'block font-display font-extrabold leading-[.95] tracking-[-0.03em] [text-shadow:0_2px_0_rgba(0,0,0,.25)]',
            size === 'sm' ? 'text-[24px]' : 'text-[30px]',
          )}
        >
          {name}
        </span>
        {chips.length > 0 && (
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.filter(Boolean).map((chip, i) => (
              <span key={i} className="rounded-pill bg-white/90 px-2.5 py-1 text-[11.5px] font-bold text-ink">
                {chip}
              </span>
            ))}
          </span>
        )}
        {children}
      </span>
    </>
  );

  const cls = cn(
    'group relative block flex-none overflow-hidden rounded-card text-white no-underline shadow-lift',
    'transition-transform duration-300 [transition-timing-function:cubic-bezier(.2,.8,.2,1)]',
    'hover:-translate-y-2.5 hover:rotate-0 hover:scale-[1.04] focus-visible:-translate-y-2.5',
    size === 'sm' ? 'h-[300px] w-[220px]' : 'h-[300px] w-[220px] sm:h-[360px] sm:w-[268px]',
    tilt === 'left' && '-rotate-2',
    tilt === 'right' && 'translate-y-2.5 rotate-2',
    className,
  );
  const style = { backgroundColor: bg };

  if (to)
    return (
      <Link to={to} className={cls} style={style} tabIndex={tabIndex} aria-label={`${name}, view profile`}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'text-left')} style={style} tabIndex={tabIndex}>
        {body}
      </button>
    );
  return (
    <div className={cls} style={style}>
      {body}
    </div>
  );
};

export default PortraitCard;
