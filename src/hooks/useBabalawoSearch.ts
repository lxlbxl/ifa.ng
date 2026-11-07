import { useState, useEffect, useMemo, useCallback } from 'react';
import { BabalawoProfile, BabalawoSearchFilters } from '@/types/babalawo';
import { supabase } from '@/integrations/supabase/client';
import { errorService } from '@/services/errorService';
import { BabalawoListResponse } from '@/types/api';

export const useBabalawoSearch = () => {
  const [babalawos, setBabalawos] = useState<BabalawoProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BabalawoSearchFilters>({});
  const [sortBy, setSortBy] = useState<'rating' | 'price' | 'experience' | 'sessions'>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchBabalawos = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('[useBabalawoSearch] Calling get_public_babalawos RPC...');
        const { data, error: rpcError } = await supabase.rpc('get_public_babalawos');

        if (rpcError) {
          throw rpcError;
        }

        console.log('[useBabalawoSearch] Data from RPC:', data);

        if (!data || data.length === 0) {
          console.log('[useBabalawoSearch] No babalawos found from RPC.');
          setBabalawos([]);
          return;
        }

        const transformedData: BabalawoProfile[] = data.map(b => ({
          id: b.id,
          full_name: b.full_name?.trim() || 'Babalawo (Name Missing)',
          avatar_url: b.avatar_url,
          specialties: b.specialties || [],
          experience_years: b.experience_years || 1,
          hourly_rate: Number(b.hourly_rate) || 15000,
          bio: b.bio || '',
          verification_status: b.verification_status || 'pending',
          rating: Number(b.rating) || 5.0,
          total_sessions: b.total_sessions || 0,
          languages: b.languages || ['English'],
          timezone: b.timezone || 'Africa/Lagos',
          is_active: b.is_active ?? true,
          is_featured: b.is_featured ?? false,
          current_status: b.current_status || 'offline',
        }));
        setBabalawos(transformedData);
      } catch (err: any) {
        console.error('[useBabalawoSearch] Error fetching babalawos via RPC:', err);
        const appError = errorService.handleError(err, 'FETCH_BABALAWOS_SEARCH_RPC');
        setError(appError.message);
        errorService.showErrorToast(appError);
      } finally {
        setLoading(false);
      }
    };
    fetchBabalawos();
  }, []);

  const retry = async () => {
    // Re-fetch babalawos
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_public_babalawos');
      if (rpcError) {
        throw rpcError;
      }
      const transformedData: BabalawoProfile[] = data.map(b => ({
        id: b.id,
        full_name: b.full_name?.trim() || 'Babalawo (Name Missing)',
        avatar_url: b.avatar_url,
        specialties: b.specialties || [],
        experience_years: b.experience_years || 1,
        hourly_rate: Number(b.hourly_rate) || 15000,
        bio: b.bio || '',
        verification_status: b.verification_status || 'pending',
        rating: Number(b.rating) || 5.0,
        total_sessions: b.total_sessions || 0,
        languages: b.languages || ['English'],
        timezone: b.timezone || 'Africa/Lagos',
        is_active: b.is_active ?? true,
        is_featured: b.is_featured ?? false,
        current_status: b.current_status || 'offline',
      }));
      setBabalawos(transformedData);
    } catch (err: any) {
      const appError = errorService.handleError(err, 'RETRY_FETCH_BABALAWOS_SEARCH_RPC');
      setError(appError.message);
      errorService.showErrorToast(appError);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedBabalawos = useMemo(() => {
    if (!babalawos) return [];

    let filtered = [...babalawos];

    // Apply search term filter
    if (filters.search_term && filters.search_term.trim()) {
      const searchTerm = filters.search_term.toLowerCase().trim();
      filtered = filtered.filter(babalawo => 
        babalawo.full_name.toLowerCase().includes(searchTerm) ||
        babalawo.bio?.toLowerCase().includes(searchTerm) ||
        babalawo.specialties?.some(specialty => 
          specialty.toLowerCase().includes(searchTerm)
        ) ||
        babalawo.languages?.some(language => 
          language.toLowerCase().includes(searchTerm)
        )
      );
    }

    // Apply specialties filter
    if (filters.specialties && filters.specialties.length > 0) {
      filtered = filtered.filter(babalawo =>
        babalawo.specialties?.some(specialty =>
          filters.specialties!.includes(specialty)
        )
      );
    }

    // Apply rating filter
    if (filters.minRating) {
      filtered = filtered.filter(babalawo =>
        (babalawo.rating || 0) >= filters.minRating!
      );
    }

    // Apply rate filter
    if (filters.maxRate) {
      filtered = filtered.filter(babalawo =>
        (babalawo.hourly_rate || 0) <= filters.maxRate!
      );
    }

    // Apply languages filter
    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(babalawo =>
        babalawo.languages?.some(language =>
          filters.languages!.includes(language)
        )
      );
    }
    
    // Apply availability filter
    if (filters.availability) {
      if (filters.availability === 'available') {
        filtered = filtered.filter(babalawo => babalawo.current_status === 'online');
      } else if (filters.availability === 'offline') {
        filtered = filtered.filter(babalawo => babalawo.current_status === 'offline');
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'rating':
          aValue = a.rating || 0;
          bValue = b.rating || 0;
          break;
        case 'price':
          aValue = a.hourly_rate || 0;
          bValue = b.hourly_rate || 0;
          break;
        case 'experience':
          aValue = a.experience_years || 0;
          bValue = b.experience_years || 0;
          break;
        case 'sessions':
          aValue = a.total_sessions || 0;
          bValue = b.total_sessions || 0;
          break;
        default:
          aValue = a.rating || 0;
          bValue = b.rating || 0;
      }

      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return filtered;
  }, [babalawos, filters, sortBy, sortOrder]);

  const updateFilter = (key: keyof BabalawoSearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getAvailableSpecialties = useCallback(() => {
    if (!babalawos) return [];
    
    const specialties = new Set<string>();
    babalawos.forEach(babalawo => {
      babalawo.specialties?.forEach(specialty => {
        specialties.add(specialty);
      });
    });
    
    return Array.from(specialties).sort();
  }, [babalawos]);

  const getAvailableLanguages = () => {
    if (!babalawos) return [];
    
    const languages = new Set<string>();
    babalawos.forEach(babalawo => {
      babalawo.languages?.forEach(language => {
        languages.add(language);
      });
    });
    
    return Array.from(languages).sort();
  };

  const getPriceRange = () => {
    if (!babalawos || babalawos.length === 0) return { min: 0, max: 100000 };
    
    const rates = babalawos
      .map(b => b.hourly_rate || 0)
      .filter(rate => rate > 0);
    
    return {
      min: Math.min(...rates),
      max: Math.max(...rates)
    };
  };

  const getSearchStats = () => {
    return {
      total: babalawos?.length || 0,
      filtered: filteredAndSortedBabalawos.length,
      hasFilters: Object.keys(filters).some(key => {
        const value = filters[key as keyof BabalawoSearchFilters];
        if (value === undefined || value === null) return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'string') return value.trim() !== '';
        if (typeof value === 'number') return value > 0;
        return Boolean(value);
      })
    };
  };

  return {
    babalawos: filteredAndSortedBabalawos,
    loading,
    error,
    retry,
    filters,
    updateFilter,
    clearFilters,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    availableSpecialties: getAvailableSpecialties(),
    availableLanguages: getAvailableLanguages(),
    priceRange: getPriceRange(),
    searchStats: getSearchStats(),
  };
};

// Helper hook for featured babalawos
export const useFeaturedBabalawos = (limit: number = 6) => {
  const { babalawos, loading, error } = useBabalawoSearch(); // Use useBabalawoSearch
  const featuredBabalawos = useMemo(() => {
    if (!babalawos) return [];

    // Sort by a combination of rating and total sessions
    const sorted = [...babalawos].sort((a, b) => {
      const aScore = (a.rating || 0) * 0.7 + (a.total_sessions || 0) * 0.3;
      const bScore = (b.rating || 0) * 0.7 + (b.total_sessions || 0) * 0.3;
      return bScore - aScore;
    });

    return sorted.slice(0, limit);
  }, [babalawos, limit]);

  return {
    featuredBabalawos,
    loading,
    error
  };
};

// Helper hook for babalawo recommendations based on user preferences
export const useBabalawoRecommendations = (userPreferences?: {
  preferredSpecialties?: string[];
  preferredLanguages?: string[];
  maxBudget?: number;
}) => {
  const { babalawos, loading, error } = useBabalawoSearch(); // Use useBabalawoSearch

  const recommendedBabalawos = useMemo(() => {
    if (!babalawos || !userPreferences) return [];

    let scored = babalawos.map(babalawo => {
      let score = babalawo.rating || 0;

      // Boost score for matching specialties
      if (userPreferences.preferredSpecialties) {
        const matchingSpecialties = babalawo.specialties?.filter(s =>
          userPreferences.preferredSpecialties!.includes(s)
        ).length || 0;
        score += matchingSpecialties * 2;
      }

      // Boost score for matching languages
      if (userPreferences.preferredLanguages) {
        const matchingLanguages = babalawo.languages?.filter(l =>
          userPreferences.preferredLanguages!.includes(l)
        ).length || 0;
        score += matchingLanguages * 1;
      }

      // Penalize if over budget
      if (userPreferences.maxBudget && babalawo.hourly_rate) {
        if (babalawo.hourly_rate > userPreferences.maxBudget) {
          score -= 3;
        }
      }

      return { babalawo, score };
    });

    // Filter out negative scores and sort by score
    scored = scored.filter(item => item.score > 0);
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 10).map(item => item.babalawo);
  }, [babalawos, userPreferences]);

  return {
    recommendedBabalawos,
    loading,
    error
  };
};
