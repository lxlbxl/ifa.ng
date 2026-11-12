import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { SUPPORT_EMAIL } from '@/hooks/usePlatformRules';

const cols = [
  {
    title: 'Consult',
    links: [
      { to: '/search', label: 'Find a Babalawo' },
      { to: '/#how', label: 'How it works' },
      { to: '/#sessions', label: 'Sessions on Google Meet' },
      { to: '/#faq', label: 'Questions' },
    ],
  },
  {
    title: 'Babalawos',
    links: [
      { to: '/become-a-babalawo', label: 'Apply to join' },
      { to: '/dashboard', label: 'Babalawo dashboard' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { to: '/terms', label: 'Terms of use' },
      { to: '/privacy', label: 'Privacy policy' },
      { to: '/refunds', label: 'Refunds and cancellations' },
      { to: '/support', label: 'Help and support' },
      { href: `mailto:${SUPPORT_EMAIL}`, label: SUPPORT_EMAIL },
    ],
  },
];

/** Ink footer shared by every public page. */
const Footer = () => (
  <footer className="bg-ink pb-safe text-[#bfbaa9]">
    <div className="wrap grid grid-cols-2 gap-x-6 gap-y-6 py-8 sm:gap-x-8 md:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] md:gap-8 md:py-9">
      <div className="col-span-2 max-w-xs md:col-span-1">
        <Logo tone="light" size="sm" />
        <p className="mt-3 text-xs leading-relaxed">
          Consult a verified Babalawo over Google Meet, wherever you are, and keep written notes from every session.
        </p>
      </div>
      {cols.map((c) => (
        <div key={c.title}>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sun">{c.title}</h3>
          <ul className="space-y-1.5 text-[13px] leading-snug">
            {c.links.map((l) => (
              <li key={l.label}>
                {'href' in l && l.href ? (
                  <a href={l.href} className="text-cloth/85 no-underline hover:text-white hover:underline">
                    {l.label}
                  </a>
                ) : (
                  <Link to={(l as { to: string }).to} className="text-cloth/85 no-underline hover:text-white hover:underline">
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="wrap flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-white/10 py-3 text-[11px]">
      <span>© {new Date().getFullYear()} IFA.ng</span>
      <span>Ẹ kú àbọ̀. Made in Nigeria for the world.</span>
    </div>
  </footer>
);

export default Footer;
