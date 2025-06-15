
import { Star, Video, MessageCircle, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const babalawos = [
  {
    id: 1,
    name: "Baba Ifasegun Aworeni",
    image: "/placeholder.svg",
    specialty: "Ifa Divination",
    rating: 4.9,
    reviews: 127,
    experience: "25+ years",
    location: "Osogbo, Nigeria",
    languages: ["English", "Yoruba"],
    rate: "$45/hour",
    isOnline: true,
    nextAvailable: "Today 2:00 PM",
    description: "Master of traditional Ifa divination with deep understanding of Odu Ifa and spiritual guidance."
  },
  {
    id: 2,
    name: "Baba Olumide Ogundipe",
    image: "/placeholder.svg",
    specialty: "Life Coaching",
    rating: 4.8,
    reviews: 89,
    experience: "15+ years",
    location: "Lagos, Nigeria",
    languages: ["English", "Yoruba", "French"],
    rate: "$35/hour",
    isOnline: false,
    nextAvailable: "Tomorrow 10:00 AM",
    description: "Experienced spiritual counselor specializing in life direction and personal transformation."
  },
  {
    id: 3,
    name: "Mama Adunni Olatunji",
    image: "/placeholder.svg",
    specialty: "Ancestral Healing",
    rating: 5.0,
    reviews: 156,
    experience: "30+ years",
    location: "Ibadan, Nigeria",
    languages: ["English", "Yoruba"],
    rate: "$55/hour",
    isOnline: true,
    nextAvailable: "Today 4:30 PM",
    description: "Renowned healer specializing in ancestral connections and spiritual cleansing rituals."
  }
];

const FeaturedBabalawos = () => {
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
          {babalawos.map((babalawo, index) => (
            <div key={babalawo.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden animate-fade-in" style={{animationDelay: `${index * 0.2}s`}}>
              {/* Profile Header */}
              <div className="relative p-6 pb-4">
                <div className="flex items-start space-x-4">
                  <div className="relative">
                    <img 
                      src={babalawo.image} 
                      alt={babalawo.name}
                      className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-md"
                    />
                    {babalawo.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">
                      {babalawo.name}
                    </h3>
                    <Badge variant="secondary" className="mb-2 text-xs">
                      {babalawo.specialty}
                    </Badge>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-accent fill-current mr-1" />
                        <span className="font-semibold text-gray-900">{babalawo.rating}</span>
                        <span className="text-gray-600 ml-1">({babalawo.reviews})</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>{babalawo.experience}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="px-6 pb-4">
                <p className="text-gray-700 text-sm mb-4 leading-relaxed">
                  {babalawo.description}
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{babalawo.location}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <MessageCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{babalawo.languages.join(", ")}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-gray-600">
                      <span className="text-sm">Next available:</span>
                      <div className="font-semibold text-gray-900">{babalawo.nextAvailable}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{babalawo.rate}</div>
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
          ))}
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
