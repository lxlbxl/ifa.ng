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
import { Star, Search as SearchIcon, Filter, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import ScrollReveal from '@/components/animations/ScrollReveal';
import CounterAnimation from '@/components/animations/CounterAnimation';

const LoadingState = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
    {[...Array(9)].map((_, i) => (
      <motion.div
        key={i}
        className="bg-white rounded-xl shadow-md p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
      >
        <div className="flex flex-col items-center">
          <Skeleton className="w-20 h-20 rounded-full mb-3" />
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-28 mb-3" />
          <div className="flex gap-1 mb-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      </motion.div>
    ))}
  </div>
);

const ErrorState = () => (
  <motion.div
    className="text-center py-12"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
      <span className="text-3xl">⚠️</span>
    </div>
    <p className="text-red-600 font-medium">Error loading Babalawos</p>
    <p className="text-sm text-gray-500 mt-2">Please try again later.</p>
  </motion.div>
);

const EmptyState = () => (
  <motion.div
    className="text-center py-12"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
      <SearchIcon className="w-8 h-8 text-gray-400" />
    </div>
    <p className="text-gray-600 font-medium">No Babalawos match your search criteria</p>
    <p className="text-sm text-gray-500 mt-2">Try adjusting your filters to see more results.</p>
  </motion.div>
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-40 left-20 w-64 h-64 rounded-full bg-gradient-to-br from-orange-200/20 to-pink-200/20 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 40, 0],
              y: [0, 30, 0],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-40 right-20 w-80 h-80 rounded-full bg-gradient-to-br from-purple-200/20 to-blue-200/20 blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              x: [0, -40, 0],
              y: [0, -30, 0],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          {/* Page Header */}
          <ScrollReveal direction="up">
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                  Find Your{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-pink-600">
                    Spiritual Guide
                  </span>
                </h1>
              </div>
              {!loading && !error && babalawos.length > 0 && (
                <motion.p
                  className="text-gray-600 flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <CounterAnimation end={babalawos.length} duration={1.5} />
                  <span>verified {babalawos.length === 1 ? 'Babalawo' : 'Babalawos'} available</span>
                </motion.p>
              )}
            </motion.div>
          </ScrollReveal>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filter Sidebar */}
            <aside className="lg:col-span-1">
              <ScrollReveal direction="left">
                <motion.div
                  className="sticky top-24 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <Filter className="w-5 h-5 text-orange-500" />
                    <h2 className="text-xl font-semibold text-gray-900">Filters</h2>
                  </div>
                  <div className="space-y-6">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Label htmlFor="search-term" className="text-gray-700 font-medium">Search by Name</Label>
                      <Input
                        id="search-term"
                        placeholder="e.g., Adebayo"
                        className="mt-2 border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                        onChange={(e) => handleFilterChange('search_term', e.target.value)}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Label htmlFor="specialty" className="text-gray-700 font-medium">Specialty</Label>
                      <Select onValueChange={(value) => handleFilterChange('specialties', value === 'all' ? [] : [value])}>
                        <SelectTrigger id="specialty" className="mt-2 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
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
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Label htmlFor="rating" className="text-gray-700 font-medium">Minimum Rating</Label>
                      <Select onValueChange={(value) => handleFilterChange('minRating', value)}>
                        <SelectTrigger id="rating" className="mt-2 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="Any Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1"><Star className="w-4 h-4 inline-block mr-1 fill-yellow-400 text-yellow-400" /> 1+</SelectItem>
                          <SelectItem value="2"><Star className="w-4 h-4 inline-block mr-1 fill-yellow-400 text-yellow-400" /> 2+</SelectItem>
                          <SelectItem value="3"><Star className="w-4 h-4 inline-block mr-1 fill-yellow-400 text-yellow-400" /> 3+</SelectItem>
                          <SelectItem value="4"><Star className="w-4 h-4 inline-block mr-1 fill-yellow-400 text-yellow-400" /> 4+</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Label htmlFor="availability" className="text-gray-700 font-medium">Availability</Label>
                      <Select
                        defaultValue={searchParams.get('availability') || 'all'}
                        onValueChange={(value) => handleFilterChange('availability', value === 'all' ? '' : value)}
                      >
                        <SelectTrigger id="availability" className="mt-2 border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="available">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              Available Now
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  </div>
                </motion.div>
              </ScrollReveal>
            </aside>

            {/* Results Grid */}
            <main className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {loading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <LoadingState />
                  </motion.div>
                )}
                {!loading && error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ErrorState />
                  </motion.div>
                )}
                {!loading && !error && babalawos.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <EmptyState />
                  </motion.div>
                )}
                {!loading && !error && babalawos.length > 0 && (
                  <motion.div
                    key="results"
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {babalawos.map((babalawo, index) => (
                      <motion.div
                        key={babalawo.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: index * 0.05,
                          duration: 0.4,
                          ease: [0.25, 0.1, 0.25, 1]
                        }}
                      >
                        <BabalawoCard
                          babalawo={babalawo}
                          onBookSession={handleBookSession}
                          onViewProfile={handleViewProfile}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
      </div>
    </ErrorBoundary>
  );
};

export default SearchPage;
