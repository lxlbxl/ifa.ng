
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBabalawoById } from '@/hooks/useBabalawos';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Star, 
  CheckCircle, 
  Calendar, 
  Globe, 
  Award,
  ArrowLeft,
  Clock,
  Users
} from 'lucide-react';
import BookSessionModal from './dashboard/user/BookSessionModal';
import { useAuth } from '@/hooks/useAuth';

const BabalawoProfile = () => {
  const { babalawoId } = useParams<{ babalawoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: babalawo, isLoading, error } = useBabalawoById(babalawoId!);
  const [showBookingModal, setShowBookingModal] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Babalawo profile...</p>
        </div>
      </div>
    );
  }

  if (error || !babalawo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              The Babalawo profile you're looking for could not be found.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go Back Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = babalawo.profiles;
  const displayName = profile?.full_name || "Babalawo";
  const avatarUrl = profile?.avatar_url;

  const handleBookSession = () => {
    if (!user) {
      navigate('/auth?tab=signin');
      return;
    }
    
    const babalawoForModal = {
      id: babalawo.id,
      full_name: displayName,
      avatar_url: avatarUrl,
      title: "Ifa Priest & Spiritual Guide",
      specialties: Array.isArray(babalawo.specialties) ? babalawo.specialties : [],
      rating: babalawo.rating ? Number(babalawo.rating) : 5,
      reviews: babalawo.total_sessions ?? 0,
      verified: babalawo.verification_status === 'approved',
      nextAvailable: 'Flexible',
      hourly_rate: babalawo.hourly_rate ? Number(babalawo.hourly_rate) : 15000,
      price: babalawo.hourly_rate ? `₦${Number(babalawo.hourly_rate).toLocaleString()}/hr` : '₦15,000/hr',
    };
    
    setShowBookingModal(true);
  };

  const babalawoForModal = {
    id: babalawo.id,
    full_name: displayName,
    avatar_url: avatarUrl,
    title: "Ifa Priest & Spiritual Guide",
    specialties: Array.isArray(babalawo.specialties) ? babalawo.specialties : [],
    rating: babalawo.rating ? Number(babalawo.rating) : 5,
    reviews: babalawo.total_sessions ?? 0,
    verified: babalawo.verification_status === 'approved',
    nextAvailable: 'Flexible',
    hourly_rate: babalawo.hourly_rate ? Number(babalawo.hourly_rate) : 15000,
    price: babalawo.hourly_rate ? `₦${Number(babalawo.hourly_rate).toLocaleString()}/hr` : '₦15,000/hr',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Profile Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex justify-center sm:justify-start">
                    <Avatar className="w-32 h-32 border-4 border-primary">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={displayName} />
                      ) : (
                        <AvatarFallback className="text-3xl">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                      <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                      {babalawo.verification_status === 'approved' && (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-4">Ifa Priest & Spiritual Guide</p>
                    
                    <div className="flex items-center justify-center sm:justify-start gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-5 w-5 ${
                              star <= Math.round(babalawo.rating || 0) 
                                ? "text-yellow-400 fill-current" 
                                : "text-gray-300"
                            }`} 
                          />
                        ))}
                        <span className="ml-2 text-sm text-gray-600">
                          {babalawo.rating?.toFixed(1) || '5.0'} ({babalawo.total_sessions || 0} sessions)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {babalawo.languages && babalawo.languages.length > 0 && 
                        babalawo.languages.map((language, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {language}
                          </Badge>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bio Section */}
            {babalawo.bio && (
              <Card>
                <CardHeader>
                  <CardTitle>About Me</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 leading-relaxed">{babalawo.bio}</p>
                </CardContent>
              </Card>
            )}

            {/* Specialties */}
            {babalawo.specialties && babalawo.specialties.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Areas of Specialty</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {babalawo.specialties.map((specialty, index) => (
                      <Badge key={index} className="bg-primary/10 text-primary hover:bg-primary/20">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Booking Card */}
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-center">Book a Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    ₦{(babalawo.hourly_rate || 15000).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">per session</div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Duration: 60 minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Available: Flexible scheduling</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>Private 1-on-1 consultation</span>
                  </div>
                </div>
                
                <Button 
                  onClick={handleBookSession}
                  className="w-full"
                  size="lg"
                >
                  Book Session Now
                </Button>
              </CardContent>
            </Card>

            {/* Experience Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {babalawo.experience_years && (
                  <div>
                    <div className="font-semibold">{babalawo.experience_years} Years</div>
                    <div className="text-sm text-gray-600">Spiritual Practice</div>
                  </div>
                )}
                
                <div>
                  <div className="font-semibold">{babalawo.total_sessions || 0}</div>
                  <div className="text-sm text-gray-600">Total Sessions</div>
                </div>
                
                {babalawo.verification_status === 'approved' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Verified Babalawo</span>
                  </div>
                )}
                
                {babalawo.timezone && (
                  <div>
                    <div className="font-semibold">Timezone</div>
                    <div className="text-sm text-gray-600">{babalawo.timezone}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookSessionModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        babalawo={babalawoForModal}
      />
    </div>
  );
};

export default BabalawoProfile;
