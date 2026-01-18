import React from 'react';
import { Users, Video, Star, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

const stats = [
  {
    icon: Users,
    value: '10,000+',
    label: 'Happy Clients',
    color: 'from-orange-500 to-orange-600'
  },
  {
    icon: Video,
    value: '25,000+',
    label: 'Consultations Completed',
    color: 'from-purple-500 to-purple-600'
  },
  {
    icon: Star,
    value: '4.9/5',
    label: 'Average Rating',
    color: 'from-yellow-500 to-yellow-600'
  },
  {
    icon: Globe,
    value: '50+',
    label: 'Countries Served',
    color: 'from-blue-500 to-blue-600'
  }
];

const StatsSection = () => {
  return (
    <section className="py-20 bg-gray-900 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary animate-float"></div>
        <div className="absolute bottom-10 right-10 w-24 h-24 rounded-full bg-accent animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/3 w-16 h-16 rounded-full bg-secondary animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Trusted by Thousands Worldwide
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Join a global community seeking authentic spiritual guidance
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 text-center border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className={`w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br ${stat.color} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <Icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-sm md:text-base text-gray-300 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Additional trust indicators */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-2">24/7</div>
            <div className="text-gray-300">Available Support</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-2">100%</div>
            <div className="text-gray-300">Secure & Private</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-2">98%</div>
            <div className="text-gray-300">Would Recommend</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
