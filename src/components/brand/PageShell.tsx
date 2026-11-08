import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';

/** Header + main + footer for public pages (search, profile, payment results, 404). */
export const PageShell = ({
  children,
  className,
  footer = true,
}: {
  children: React.ReactNode;
  className?: string;
  footer?: boolean;
}) => (
  <div className="flex min-h-screen flex-col bg-cloth">
    <Header variant="solid" />
    <main className={cn('flex-1', className)}>{children}</main>
    {footer && <Footer />}
  </div>
);

export default PageShell;
