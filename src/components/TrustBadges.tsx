
import { Shield, Clock, Star, Users, Lock, Heart } from "lucide-react";

const badges = [
  {
    icon: Shield,
    title: "100% Verified Babalawos",
    description: "Every spiritual guide undergoes thorough verification process"
  },
  {
    icon: Lock,
    title: "Secure & Private",
    description: "End-to-end encrypted sessions for complete privacy"
  },
  {
    icon: Clock,
    title: "24/7 Support",
    description: "Round-the-clock customer support for your peace of mind"
  },
  {
    icon: Star,
    title: "5-Star Rated Platform",
    description: "Trusted by thousands with excellent user ratings"
  },
  {
    icon: Users,
    title: "Growing Community",
    description: "Join thousands of satisfied users on their spiritual journey"
  },
  {
    icon: Heart,
    title: "Satisfaction Guaranteed",
    description: "Your spiritual satisfaction is our top priority"
  }
];

const TrustBadges = () => {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
            Why Choose IFA Connect?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Your spiritual journey deserves the highest level of trust, security, and authenticity
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {badges.map((badge, index) => (
            <div key={index} className="text-center group animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
              <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group-hover:-translate-y-1">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <badge.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">
                  {badge.title}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {badge.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center bg-white rounded-full px-8 py-4 shadow-md">
            <div className="flex items-center space-x-6 text-sm text-gray-700">
              <div className="flex items-center">
                <span className="font-bold text-primary text-lg mr-1">5,000+</span>
                <span>Happy Users</span>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div className="flex items-center">
                <span className="font-bold text-secondary text-lg mr-1">50+</span>
                <span>Verified Babalawos</span>
              </div>
              <div className="w-px h-6 bg-gray-300"></div>
              <div className="flex items-center">
                <span className="font-bold text-accent text-lg mr-1">98%</span>
                <span>Satisfaction Rate</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
