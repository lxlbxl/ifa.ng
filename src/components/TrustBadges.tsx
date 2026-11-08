
import React from 'react';
import { Shield, Users, Clock, Star } from 'lucide-react';

const TrustBadges = () => {
  const badges = [
    {
      icon: Shield,
      title: "100% Secure",
      description: "All sessions are private and confidential"
    },
    {
      icon: Users,
      title: "50+ Verified Babalawos",
      description: "Carefully vetted spiritual guides"
    },
    {
      icon: Clock,
      title: "24/7 Available",
      description: "Book sessions at your convenience"
    },
    {
      icon: Star,
      title: "98% Satisfaction Rate",
      description: "Highly rated by our community"
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose IFA.ng?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Connect with authentic spiritual guides for life-changing consultations through secure sessions.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((badge, index) => (
            <div key={index} className="bg-white rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <badge.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {badge.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
        
        <div className="mt-12 bg-white rounded-2xl p-8 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Satisfaction Guaranteed
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Your spiritual satisfaction is our top priority. If you're not completely satisfied with your consultation, we'll make it right.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-primary/5 rounded-lg p-4">
                <div className="text-3xl font-bold text-primary mb-2">50+</div>
                <div className="text-sm text-gray-600">Verified Babalawos</div>
              </div>
              <div className="bg-accent/5 rounded-lg p-4">
                <div className="text-3xl font-bold text-accent mb-2">98%</div>
                <div className="text-sm text-gray-600">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
