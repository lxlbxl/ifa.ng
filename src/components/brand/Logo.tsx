import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** "light" puts white text on dark surfaces (hero, footer); "dark" is ink text. */
  tone?: 'light' | 'dark';
  /** "header" is the large mark used alone in the site header, so the ".ng" in it reads. */
  size?: 'sm' | 'md' | 'lg' | 'header';
  /** Hide the "IFA.ng" wordmark and show the mark only. */
  markOnly?: boolean;
  to?: string | null;
  className?: string;
}

const sizes = {
  sm: { mark: 'h-8 w-8', text: 'text-lg' },
  md: { mark: 'h-11 w-11', text: 'text-2xl' },
  lg: { mark: 'h-14 w-14', text: 'text-3xl' },
  header: { mark: 'h-[60px] w-[60px] lg:h-[72px] lg:w-[72px]', text: 'text-3xl' },
};

/** The IFA.ng mark (public/brand/ifa-logo.png) with the wordmark beside it. */
export const Logo = ({ tone = 'dark', size = 'md', markOnly, to = '/', className }: LogoProps) => {
  const inner = (
    <>
      <span className={cn('grid flex-none place-items-center rounded-full bg-paper p-[2px]', sizes[size].mark)}>
        <img src="/brand/ifa-logo.png" alt="" className="h-full w-full object-contain" />
      </span>
      {!markOnly && (
        <span
          className={cn(
            'font-display font-extrabold leading-none tracking-[-0.03em]',
            sizes[size].text,
            tone === 'light' ? 'text-white' : 'text-ink',
          )}
        >
          IFA.ng
        </span>
      )}
    </>
  );
  const cls = cn('inline-flex items-center gap-2.5 no-underline', className);
  if (!to) return <span className={cls} aria-label="IFA.ng">{inner}</span>;
  return (
    <Link to={to} className={cls} aria-label="IFA.ng home">
      {inner}
    </Link>
  );
};

export default Logo;
