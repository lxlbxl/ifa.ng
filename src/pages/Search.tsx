import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBabalawoSearch } from '@/hooks/useBabalawoSearch';
import BabalawoCard from '@/components/babalawo/BabalawoCard';
import ErrorBoundary from '@/components/ErrorBoundary';
import { BabalawoProfile, BabalawoSearchFilters } from '@/types/babalawo';
import InstantConsultationModal from '@/components/dashboard/user/InstantConsultationModal';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star } from 'lucide-react';

const LoadingState = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
    ))}
  </div>
);

const ErrorState = () => (
  <div className="text-center py-12 text-red-600">
    <p>Error loading Babalawos. Please try again later.</p>
  </div>
);

const EmptyState = () => (
  <div className="text-center py-12">
    <p className="text-gray-600">No Babalawos match your search criteria.</p>
    <p className="text-sm text-gray-500 mt-2">Try adjusting your filters.</p>
  </div>
);

const SearchPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBabalawo, setSelectedBabalawo] = useState<BabalawoProfile | null>(null);

  const { babalawos, loading, error, updateFilter, availableSpecialties } = useBabalawoSearch();

  const handleFilterChange = (filter: keyof BabalawoSearchFilters, value: string | string[] | number | undefined) => {
    updateFilter(filter, value);
  };

  const handleBookSession = (babalawo: BabalawoProfile) => {
    setSelectedBabalawo(babalawo);
    setIsModalOpen(true);
  };

  const handleViewProfile = (babalawoId: string) => {
    navigate(`/babalawo/${babalawoId}`);
  };

  return (
    <ErrorBoundary fallback={<ErrorState />}>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <h2 className="text-xl font-semibold mb-4">Filters</h2>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="search-term">Search by Name</Label>
                  <Input
                    id="search-term"
                    placeholder="e.g., Adebayo"
                    onChange={(e) => handleFilterChange('search_term', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="specialty">Specialty</Label>
                  <Select onValueChange={(value) => handleFilterChange('specialties', value === 'all' ? [] : [value])}>
                    <SelectTrigger id="specialty">
                      <SelectValue placeholder="All Specialties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specialties</SelectItem>
                      {availableSpecialties.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rating">Minimum Rating</Label>
                  <Select onValueChange={(value) => handleFilterChange('minRating', value)}>
                    <SelectTrigger id="rating">
                      <SelectValue placeholder="Any Rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1"><Star className="w-4 h-4 inline-block mr-1" /> 1+</SelectItem>
                      <SelectItem value="2"><Star className="w-4 h-4 inline-block mr-1" /> 2+</SelectItem>
                      <SelectItem value="3"><Star className="w-4 h-4 inline-block mr-1" /> 3+</SelectItem>
                      <SelectItem value="4"><Star className="w-4 h-4 inline-block mr-1" /> 4+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="availability">Availability</Label>
                  <Select
                    defaultValue={searchParams.get('availability') || 'all'}
                    onValueChange={(value) => handleFilterChange('availability', value === 'all' ? '' : value)}
                  >
                    <SelectTrigger id="availability">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="available">Available Now</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-3">
            {loading && <LoadingState />}
            {!loading && error && <ErrorState />}
            {!loading && !error && babalawos.length === 0 && <EmptyState />}
            {!loading && !error && babalawos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {babalawos.map((babalawo) => (
                  <BabalawoCard
                    key={babalawo.id}
                    babalawo={babalawo}
                    onBookSession={handleBookSession}
                    onViewProfile={handleViewProfile}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
        {selectedBabalawo && (
          <InstantConsultationModal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            babalawo={selectedBabalawo}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default SearchPage;
