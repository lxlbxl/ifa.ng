import { Star, Video, MessageCircle, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBabalawos } from "@/hooks/useBabalawos";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

// Define the local expected profile shape
type Profile = {
  id: string;
  avatar_url?: string | null;
  full_name?: string | null;
};

const FeaturedBabalawos = () => {
  const { data: babalawos, isLoading } = useBabalawos();

  if (isLoading) {
    return (
      <section id="babalawos" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Featured Babalawos
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Connect with our most experienced and highly-rated spiritual guides
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!babalawos || babalawos.length === 0) {
    return (
      <section id="babalawos" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Featured Babalawos
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Connect with our most experienced and highly-rated spiritual guides
            </p>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600">No approved Babalawos available at the moment.</p>
            <p className="text-sm text-gray-500 mt-2">Please check back later.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="babalawos" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Featured Babalawos
          </h2>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Connect with our most experienced and highly-rated spiritual guides
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {babalawos.map((babalawo, index) => {
            let profile: Profile | null = null;
            if (
              babalawo &&
              babalawo.profiles &&
              typeof babalawo.profiles === "object" &&
              babalawo.profiles !== null &&
              "id" in babalawo.profiles
            ) {
              // TypeScript: Narrow to Profile by assertion
              profile = babalawo.profiles as Profile;
            }

            return (
              <div
                key={babalawo.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                {/* Profile Header */}
                <div className="relative p-6 pb-4">
                  <div className="flex items-start space-x-4">
                    <div className="relative">
                      <img
                        src={profile && profile.avatar_url ? profile.avatar_url : "/placeholder.svg"}
                        alt={profile && profile.full_name ? profile.full_name : "Babalawo"}
                        className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-md"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">
                        {profile && profile.full_name ? profile.full_name : "Anonymous"}
                      </h3>
                      <Badge variant="secondary" className="mb-2 text-xs">
                        {babalawo.specialties?.[0] || "General Guidance"}
                      </Badge>

                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-accent fill-current mr-1" />
                          <span className="font-semibold text-gray-900">{babalawo.rating || 0}</span>
                          <span className="text-gray-600 ml-1">({babalawo.total_sessions || 0})</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-1" />
                          <span>{babalawo.experience_years || 0}+ years</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="px-6 pb-4">
                  <p className="text-gray-700 text-sm mb-4 leading-relaxed">
                    {babalawo.bio || "Experienced spiritual guide ready to help you on your journey."}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>{babalawo.timezone || "UTC"}</span>
                    </div>

                    <div className="flex items-center text-gray-600">
                      <MessageCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span>{babalawo.languages?.join(", ") || "English"}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-gray-600">
                        <span className="text-sm">Rate:</span>
                        <div className="font-semibold text-gray-900">${babalawo.hourly_rate || 0}/hour</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-green-600 font-medium">Available</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                  <div className="flex space-x-3">
                    <button className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow">
                      Book Now
                    </button>
                    <button className="p-3 border border-gray-300 hover:border-primary text-gray-700 hover:text-primary rounded-lg transition-all duration-300">
                      <Video className="w-5 h-5" />
                    </button>
                    <button className="p-3 border border-gray-300 hover:border-primary text-gray-700 hover:text-primary rounded-lg transition-all duration-300">
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <button className="bg-secondary hover:bg-secondary-dark text-white font-semibold px-8 py-4 rounded-lg text-lg shadow-lg transition-all duration-300">
            View All Babalawos
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedBabalawos;
