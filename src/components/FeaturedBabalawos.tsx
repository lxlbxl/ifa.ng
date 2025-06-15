
import { Button } from "@/components/ui/button";
import { Star, Clock, Video } from "lucide-react";

const babalawos = [
  {
    name: "Baba Ifasegun Adeyemi",
    specialty: "Ifa Divination & Life Guidance",
    experience: "25+ years",
    rating: 4.9,
    reviews: 234,
    languages: ["English", "Yoruba"],
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    price: "₦15,000",
    availability: "Available Now",
    badges: ["Top Rated", "Most Booked"]
  },
  {
    name: "Yeye Osun Folake",
    specialty: "Osun Worship & Fertility",
    experience: "18+ years",
    rating: 4.8,
    reviews: 189,
    languages: ["English", "Yoruba", "French"],
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
    price: "₦12,000",
    availability: "Next: Tomorrow 2pm",
    badges: ["Verified", "Expert"]
  },
  {
    name: "Chief Babatunde Ogundimu",
    specialty: "Ogun Tradition & Protection",
    experience: "30+ years",
    rating: 5.0,
    reviews: 156,
    languages: ["English", "Yoruba"],
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    price: "₦18,000",
    availability: "Available Now",
    badges: ["Master", "Verified"]
  }
];

const FeaturedBabalawos = () => {
  return (
    <section id="babalawos" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Meet Our Verified Babalawos
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Connect with experienced spiritual guides who have been carefully verified for authenticity and expertise
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {babalawos.map((babalawo, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 animate-fade-in" style={{animationDelay: `${index * 0.15}s`}}>
              {/* Profile Header */}
              <div className="relative p-6 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <img
                      src={babalawo.image}
                      alt={babalawo.name}
                      className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 mb-1">{babalawo.name}</h3>
                    <p className="text-sm text-gray-700 mb-2">{babalawo.specialty}</p>
                    
                    {/* Rating */}
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-semibold text-gray-800">{babalawo.rating}</span>
                      <span className="text-sm text-gray-600">({babalawo.reviews} reviews)</span>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {babalawo.badges.map((badge, badgeIndex) => (
                    <span key={badgeIndex} className="px-3 py-1 bg-gradient-primary text-white text-xs font-semibold rounded-full">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Experience</span>
                    <span className="text-sm font-semibold text-gray-900">{babalawo.experience}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Languages</span>
                    <span className="text-sm font-semibold text-gray-900">{babalawo.languages.join(", ")}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Availability
                    </span>
                    <span className="text-sm font-semibold text-green-700">{babalawo.availability}</span>
                  </div>
                </div>

                {/* Price and Action */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <span className="text-2xl font-bold text-primary">{babalawo.price}</span>
                    <span className="text-sm text-gray-600 ml-1">/session</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                      <Video className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" className="bg-gradient-primary hover:opacity-90 text-white">
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white font-semibold px-8">
            View All Babalawos
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedBabalawos;
