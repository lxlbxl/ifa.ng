import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Eyebrow, PageShell } from '@/components/brand';

const NotFound = () => (
  <PageShell>
    <section className="wrap py-24 text-center md:py-32">
      <Eyebrow className="text-camwood">404 · Page not found</Eyebrow>
      <h1 className="mx-auto mt-4 max-w-[14ch] font-display text-display-lg font-extrabold">
        This path hasn't been <span className="text-camwood">cast.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-[44ch] text-lg text-muted-foreground">
        The page you're looking for isn't here. Head home or find a Babalawo.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="sun" size="lg"><Link to="/search">Find a Babalawo</Link></Button>
        <Button asChild variant="outline" size="lg"><Link to="/">Back home</Link></Button>
      </div>
    </section>
  </PageShell>
);

export default NotFound;
