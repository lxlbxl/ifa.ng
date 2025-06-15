import React from 'react';
import { Star, MapPin, Calendar, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import BookSessionModal from "./BookSessionModal";

const FindBabalawo = () => {
  // Mock data for babalawos - in real app this would come from API
  const babalawos = [
    {
      id: 1,
      name: "Babalawo Adebayo",
      title: "Ifa Priest & Spiritual Counselor",
      specialties: ["Ifa Reading", "Destiny Path", "Love & Relationships"],
      rating: 4.9,
      reviews: 127,
      avatar: null,
      verified: true,
      nextAvailable: "Tomorrow, 2:00 PM",
      price: "$85/session"
    },
    {
      id: 2,
      name: "Babalawo Ogundimu",
      title: "Traditional Healer",
      specialties: ["Ebo Rituals", "Health & Healing", "Protection"],
      rating: 4.8,
      reviews: 89,
      avatar: null,
      verified: true,
      nextAvailable: "Today, 6:00 PM",
      price: "$95/session"
    },
    {
      id: 3,
      name: "Babalawo Folarin",
      title: "Egbe Specialist",
      specialties: ["Egbe Consultation", "Career Guidance", "Financial Prosperity"],
      rating: 4.7,
      reviews: 156,
      avatar: null,
      verified: true,
      nextAvailable: "Monday, 10:00 AM",
      price: "$75/session"
    }
  ];

  const [bookingBabalawo, setBookingBabalawo] = useState<any | null>(null);

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Find a Babalawo</h2>
        <p className="text-gray-600">Connect with verified spiritual guides for personalized consultations</p>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            All Specialties
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Ifa Reading
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Love & Relationships
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Career Guidance
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Health & Healing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {babalawos.map((babalawo) => (
          <div key={babalawo.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-primary">
                  {babalawo.name.split(' ')[1]?.[0] || 'B'}
                </span>
              </div>
              <div className="flex items-center justify-center mb-1">
                <h3 className="font-semibold text-gray-800">{babalawo.name}</h3>
                {babalawo.verified && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                )}
              </div>
              <p className="text-sm text-gray-500">{babalawo.title}</p>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-center mb-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 text-yellow-400 fill-current" />
                  ))}
                  <span className="ml-1 text-sm text-gray-600">
                    {babalawo.rating} ({babalawo.reviews} reviews)
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Specialties:</h4>
              <div className="flex flex-wrap gap-1">
                {babalawo.specialties.map((specialty, index) => (
                  <span key={index} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                Next available: {babalawo.nextAvailable}
              </div>
              <div className="text-sm font-medium text-gray-800">
                {babalawo.price}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                onClick={() => setBookingBabalawo(babalawo)}
                type="button"
              >
                Book Now
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>
      <BookSessionModal
        open={!!bookingBabalawo}
        onOpenChange={(open) => setBookingBabalawo(open ? bookingBabalawo : null)}
        babalawo={bookingBabalawo}
      />
    </div>
  );
};

export default FindBabalawo;
