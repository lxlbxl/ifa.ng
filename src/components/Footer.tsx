import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

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
      { to: '/auth?tab=signup', label: 'Apply to join' },
      { to: '/dashboard', label: 'Babalawo dashboard' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { to: '/#faq', label: 'Privacy and consent' },
      { to: '/#faq', label: 'Refunds' },
      { href: 'mailto:support@ifa.ng', label: 'support@ifa.ng' },
    ],
  },
];

/** Ink footer shared by every public page. */
const Footer = () => (
  <footer className="bg-ink pb-safe text-[#bfbaa9]">
    <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
      <div className="max-w-sm">
        <Logo tone="light" />
        <p className="mt-5 text-[15px] leading-relaxed">
          Consult a verified Babalawo over Google Meet, wherever you are, and keep written notes from every session.
        </p>
      </div>
      {cols.map((c) => (
        <div key={c.title}>
          <h3 className="eyebrow mb-4 text-sun">{c.title}</h3>
          <ul className="space-y-2.5 text-[15px]">
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
    <div className="wrap flex flex-wrap justify-between gap-4 border-t border-white/10 py-6 text-[13px]">
      <span>© {new Date().getFullYear()} IFA.ng</span>
      <span>Ẹ kú àbọ̀. Made in Nigeria for the world.</span>
    </div>
  </footer>
);

export default Footer;
