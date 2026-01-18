import React from 'react';
import { ArrowRight, Sparkles, Shield, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-to-br from-primary via-orange-600 to-accent relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white animate-float"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-white animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-white animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 rounded-full bg-white animate-float" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white font-medium mb-6">
              <Sparkles className="w-5 h-5" />
              <span>Begin Your Spiritual Journey Today</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Ready to Connect with Authentic Spiritual Guidance?
            </h2>

            <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands who have found clarity, purpose, and peace through verified Babalawos. Your transformation begins with a single consultation.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/auth?tab=signup')}
                className="bg-white text-primary hover:bg-gray-100 font-bold px-8 py-4 rounded-full text-lg shadow-2xl inline-flex items-center justify-center gap-2 transition-all"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/search')}
                className="bg-transparent border-2 border-white text-white hover:bg-white/10 font-bold px-8 py-4 rounded-full text-lg inline-flex items-center justify-center gap-2 transition-all"
              >
                Browse Babalawos
              </motion.button>
            </div>

            {/* Trust indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
              >
                <Shield className="w-10 h-10 text-white mx-auto mb-3" />
                <div className="text-white font-semibold mb-1">100% Verified</div>
                <div className="text-white/80 text-sm">All Babalawos authenticated</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
              >
                <Video className="w-10 h-10 text-white mx-auto mb-3" />
                <div className="text-white font-semibold mb-1">Secure Sessions</div>
                <div className="text-white/80 text-sm">End-to-end encryption</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
              >
                <Sparkles className="w-10 h-10 text-white mx-auto mb-3" />
                <div className="text-white font-semibold mb-1">Money Back</div>
                <div className="text-white/80 text-sm">Satisfaction guaranteed</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
