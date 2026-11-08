import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { useBabalawoSearch } from '@/hooks/useBabalawoSearch';
import BabalawoGrid from '@/components/babalawo/BabalawoGrid';
import ErrorBoundary from '@/components/ErrorBoundary';
import { BabalawoProfile, BabalawoSearchFilters } from '@/types/babalawo';
import { useConsultFlow } from '@/components/flow/ConsultFlow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eyebrow, OduTicker, PageShell } from '@/components/brand';
import { blockColors } from '@/design/tokens';

const LoadingState = () => (
  <div className="grid grid-cols-1 gap-x-5 gap-y-8 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex flex-col gap-3">
        <div className="aspect-[4/5] animate-pulse rounded-card opacity-25" style={{ backgroundColor: blockColors[i % blockColors.length] }} />
        <div className="h-4 w-2/3 animate-pulse rounded-pill bg-line" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-11 animate-pulse rounded-pill bg-line" />
          <div className="h-11 animate-pulse rounded-pill bg-line" />
        </div>
      </div>
    ))}
  </div>
);

const Message = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-panel border-2 border-dashed border-line bg-paper px-6 py-14 text-center">
    <SearchIcon className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
    <p className="font-display text-2xl font-extrabold">{title}</p>
    <p className="mt-1 text-muted-foreground">{body}</p>
  </div>
);

const SearchPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const { openConsult } = useConsultFlow();
  const { babalawos, loading, error, updateFilter, availableSpecialties } = useBabalawoSearch();

  const handleFilterChange = (filter: keyof BabalawoSearchFilters, value: string | string[] | number | undefined) =>
    updateFilter(filter, value);

  return (
    <ErrorBoundary fallback={<Message title="Something went wrong" body="Please refresh the page." />}>
      <PageShell>
        <section className="wrap pb-8 pt-10 md:pt-14">
          <Eyebrow className="text-camwood">Verified Babalawos</Eyebrow>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display text-display-lg font-extrabold">Find your Babalawo.</h1>
            {!loading && !error && (
              <p className="m-0 text-muted-foreground">
                {babalawos.length} {babalawos.length === 1 ? 'Babalawo' : 'Babalawos'} ready to take bookings
              </p>
            )}
          </div>

          {/* Filters */}
          <div className="mt-8 grid grid-cols-3 gap-2 rounded-panel border border-line bg-paper p-2 sm:gap-3 sm:p-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr] [&_button[role=combobox]]:max-sm:h-11 [&_button[role=combobox]]:max-sm:px-3 [&_button[role=combobox]]:max-sm:text-[13px]">
            <div className="relative col-span-3 lg:col-span-1">
              <Label htmlFor="search-term" className="sr-only">Search by name</Label>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="search-term"
                placeholder="Search by name"
                className="pl-10"
                onChange={(e) => handleFilterChange('search_term', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="specialty" className="sr-only">Specialty</Label>
              <Select onValueChange={(v) => handleFilterChange('specialties', v === 'all' ? [] : [v])}>
                <SelectTrigger id="specialty"><SelectValue placeholder="Any specialty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any specialty</SelectItem>
                  {availableSpecialties.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rating" className="sr-only">Minimum rating</Label>
              <Select onValueChange={(v) => handleFilterChange('minRating', v === 'any' ? undefined : v)}>
                <SelectTrigger id="rating"><SelectValue placeholder="Any rating" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any rating</SelectItem>
                  {['3', '4', '4.5'].map((r) => (
                    <SelectItem key={r} value={r}>★ {r} and up</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="availability" className="sr-only">Availability</Label>
              <Select
                defaultValue={searchParams.get('availability') || 'all'}
                onValueChange={(v) => handleFilterChange('availability', v === 'all' ? '' : v)}
              >
                <SelectTrigger id="availability"><SelectValue placeholder="Any time" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any time</SelectItem>
                  <SelectItem value="available">Available now</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="wrap pb-20">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <Message title="We couldn't load the Babalawos" body="Please try again in a moment." />
          ) : babalawos.length === 0 ? (
            <Message title="No one matches yet" body="Try fewer filters to see more Babalawos." />
          ) : (
            <BabalawoGrid
              babalawos={babalawos}
              onBookSession={(b) => openConsult(b)}
              onViewProfile={(id) => navigate(`/babalawo/${id}`)}
            />
          )}
        </section>
        <OduTicker />
      </PageShell>
    </ErrorBoundary>
  );
};

export default SearchPage;
