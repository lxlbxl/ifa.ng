import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Zap } from 'lucide-react';
import { useBabalawoSearch } from '@/hooks/useBabalawoSearch';

const OnlineBabalawos = () => {
  // Use the search hook with a filter for online babalawos
  const { babalawos, loading, error, updateFilter } = useBabalawoSearch();
  
  // Set the filter to show only online babalawos
  React.useEffect(() => {
    updateFilter('availability', 'available');
  }, [updateFilter]);
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading online Babalawos...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <p>Error loading online Babalawos. Please try again later.</p>
      </div>
    );
  }
  
  if (!babalawos || babalawos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No Babalawos are currently online.</p>
        <p className="text-sm text-gray-500 mt-2">Check back later or book a scheduled session.</p>
      </div>
    );
  }
  
  return (
    <div className="py-12">
      <div className="container px-4 mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Available Now</h2>
            <p className="text-gray-600 mt-1">Babalawos ready for instant consultation</p>
          </div>
          <Link to="/search?availability=available">
            <Button variant="outline">View All</Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {babalawos.slice(0, 4).map((babalawo) => (
            <Card key={babalawo.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="relative">
                  {/* Online indicator */}
                  <div className="absolute top-3 right-3 z-10">
                    <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                      <div className="relative mr-1.5">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <div className="h-2 w-2 bg-green-500 rounded-full absolute top-0 animate-ping opacity-75"></div>
                      </div>
                      Online
                    </div>
                  </div>
                  
                  <Link to={`/babalawo/${babalawo.id}`}>
                    <div className="h-48 bg-gray-100 relative">
                      {babalawo.avatar_url ? (
                        <img 
                          src={babalawo.avatar_url} 
                          alt={babalawo.full_name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                          <Avatar className="h-24 w-24">
                            <AvatarFallback className="text-4xl">
                              {babalawo.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                    </div>
                  </Link>
                  
                  <div className="p-5">
                    <Link to={`/babalawo/${babalawo.id}`}>
                      <h3 className="font-semibold text-lg mb-1 hover:text-primary transition-colors">
                        {babalawo.full_name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center mb-3">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-4 w-4 ${
                              star <= Math.round(babalawo.rating || 0) 
                                ? "text-yellow-400 fill-current" 
                                : "text-gray-300"
                            }`} 
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 ml-1">
                        ({babalawo.total_sessions || 0})
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {babalawo.specialties && babalawo.specialties.slice(0, 2).map((specialty, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                      {babalawo.specialties && babalawo.specialties.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{babalawo.specialties.length - 2} more
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-primary font-bold">
                        ₦{(babalawo.hourly_rate || 15000).toLocaleString()}
                      </div>
                      
                      <Link to={`/babalawo/${babalawo.id}`}>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          Consult Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnlineBabalawos;