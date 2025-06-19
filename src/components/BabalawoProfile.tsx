
import React from 'react';
import { useParams } from 'react-router-dom';
import { useBabalawoById } from '@/hooks/useBabalawos';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Star, CheckCircle, Globe, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import BookSessionModal from './dashboard/user/BookSessionModal';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const BabalawoProfile = () => {
  const { babalawoId } = useParams<{ babalawoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: babalawo, isLoading, error } = useBabalawoById(babalawoId || '');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f3eafd] to-[#e8ecfa]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !babalawo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f3eafd] to-[#e8ecfa]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Babalawo Not Found</h2>
          <p className="text-gray-600 mb-4">The profile you're looking for doesn't exist or is not available.</p>
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const handleBookSession = () => {
    if (!user) {
      navigate('/auth?tab=signin');
      return;
    }
    setBookingModalOpen(true);
  };

  const babalawoForModal = {
    id: babalawo.id,
    full_name: babalawo.profiles?.full_name || "Babalawo",
    avatar_url: babalawo.profiles?.avatar_url,
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
    <div className="min-h-screen bg-gradient-to-br from-[#f3eafd] to-[#e8ecfa]">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Overview */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6 text-center">
                {/* Profile Photo */}
                <Avatar className="w-32 h-32 mx-auto mb-4 border-4 border-primary">
                  {babalawo.profiles?.avatar_url ? (
                    <AvatarImage 
                      src={babalawo.profiles.avatar_url} 
                      alt={babalawo.profiles.full_name || "Babalawo"} 
                    />
                  ) : (
                    <AvatarFallback className="text-3xl">
                      {babalawo.profiles?.full_name?.charAt(0).toUpperCase() || "B"}
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Name and Verification */}
                <div className="flex items-center justify-center mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {babalawo.profiles?.full_name || "Babalawo"}
                  </h1>
                  {babalawo.verification_status === 'approved' && (
                    <CheckCircle className="w-6 h-6 text-green-500 ml-2" />
                  )}
                </div>

                <p className="text-gray-600 mb-4">Ifa Priest & Spiritual Guide</p>

                {/* Rating */}
                <div className="flex items-center justify-center mb-4">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-5 h-5 ${
                          star <= Math.round(babalawo.rating || 0) 
                            ? "text-yellow-400 fill-current" 
                            : "text-gray-300"
                        }`} 
                      />
                    ))}
                    <span className="ml-2 text-gray-600">
                      {babalawo.rating?.toFixed(1) || '5.0'} ({babalawo.total_sessions || 0} sessions)
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-2xl font-bold text-primary mb-6">
                  ₦{(babalawo.hourly_rate || 15000).toLocaleString()}/session
                </div>

                {/* Book Session Button */}
                <Button onClick={handleBookSession} className="w-full mb-4">
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Session
                </Button>

                {/* Languages */}
                {babalawo.languages && babalawo.languages.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center mb-2">
                      <Globe className="w-4 h-4 mr-2 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Languages</span>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {babalawo.languages.map((language, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {language}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* About Section */}
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                {babalawo.bio ? (
                  <p className="text-gray-700 leading-relaxed">{babalawo.bio}</p>
                ) : (
                  <p className="text-gray-500 italic">No bio available.</p>
                )}
              </CardContent>
            </Card>

            {/* Specialties */}
            <Card>
              <CardHeader>
                <CardTitle>Areas of Specialty</CardTitle>
              </CardHeader>
              <CardContent>
                {babalawo.specialties && babalawo.specialties.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {babalawo.specialties.map((specialty, index) => (
                      <Badge key={index} className="text-sm px-3 py-1">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No specialties listed.</p>
                )}
              </CardContent>
            </Card>

            {/* Experience & Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Experience & Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {babalawo.experience_years || 0}
                    </div>
                    <div className="text-sm text-gray-600">Years Experience</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {babalawo.total_sessions || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Sessions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {babalawo.rating?.toFixed(1) || '5.0'}
                    </div>
                    <div className="text-sm text-gray-600">Average Rating</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verification Status */}
            <Card>
              <CardHeader>
                <CardTitle>Verification Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  {babalawo.verification_status === 'approved' ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      <span className="text-green-700 font-medium">Verified Spiritual Guide</span>
                    </>
                  ) : babalawo.verification_status === 'pending' ? (
                    <>
                      <div className="w-5 h-5 bg-yellow-500 rounded-full mr-2" />
                      <span className="text-yellow-700 font-medium">Verification Pending</span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 bg-red-500 rounded-full mr-2" />
                      <span className="text-red-700 font-medium">Not Verified</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {babalawo.verification_status === 'approved' 
                    ? "This Babalawo has been verified by our team and meets our standards for spiritual guidance."
                    : babalawo.verification_status === 'pending'
                    ? "This Babalawo's credentials are currently being reviewed."
                    : "This Babalawo has not yet completed the verification process."
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Book Session Modal */}
      <BookSessionModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        babalawo={babalawoForModal}
      />
    </div>
  );
};

export default BabalawoProfile;
