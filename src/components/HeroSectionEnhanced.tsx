import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Shield,
  Video,
  Clock,
  Users,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Heart
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const testimonials = [
  {
    name: "Adunni Olatunji",
    text: "The guidance I received was profound and life-changing. Baba Ifasegun helped me understand my path clearly.",
    rating: 5,
    location: "Lagos, Nigeria",
    sessions: 3,
    image: null
  },
  {
    name: "Michael Thompson",
    text: "Professional, authentic, and deeply insightful. The video quality was excellent and the guidance was invaluable.",
    rating: 5,
    location: "New York, USA",
    sessions: 5,
    image: null
  },
  {
    name: "Fatima Al-Rashid",
    text: "While I was skeptical at first, I'm now a regular client. The consultation was exactly what I needed.",
    rating: 5,
    location: "Dubai, UAE",
    sessions: 8,
    image: null
  }
];

const stats = [
  { icon: Users, label: "Active Users", value: "10,000+", color: "from-blue-500 to-cyan-500" },
  { icon: CheckCircle2, label: "Sessions Completed", value: "25,000+", color: "from-green-500 to-emerald-500" },
  { icon: Star, label: "Average Rating", value: "4.9/5.0", color: "from-yellow-500 to-orange-500" },
  { icon: Clock, label: "Response Time", value: "<2 mins", color: "from-purple-500 to-pink-500" }
];

const features = [
  { text: "100% Verified Babalawos", icon: Shield },
  { text: "HD Video & Audio Sessions", icon: Video },
  { text: "24/7 Availability", icon: Clock },
  { text: "Secure & Confidential", icon: CheckCircle2 }
];

const HeroSectionEnhanced = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 min-h-screen flex items-center">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 rounded-full bg-gradient-to-br from-orange-200/30 to-pink-200/30 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-gradient-to-br from-purple-200/30 to-blue-200/30 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-br from-yellow-200/20 to-orange-200/20 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - Hero Content */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 mb-6 shadow-lg border border-orange-200"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-gray-900">
                Trusted by 10,000+ Seekers Worldwide
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Connect with{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-pink-600">
                  Authentic
                </span>
                <motion.span
                  className="absolute bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-orange-300/50 to-pink-300/50 -z-10"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                />
              </span>{" "}
              Spiritual Guides
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-lg md:text-xl lg:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto lg:mx-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Get instant access to <strong className="text-gray-900">verified Babalawos</strong> for
              personalized spiritual guidance through <strong className="text-gray-900">HD video consultations</strong>.
              Your journey to clarity starts now.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold px-8 py-6 text-lg shadow-2xl rounded-full group relative overflow-hidden"
                  onClick={() => navigate('/auth?tab=signup')}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Free Consultation
                    <motion.span
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      →
                    </motion.span>
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-500"
                    initial={{ x: "100%" }}
                    whileHover={{ x: "0%" }}
                    transition={{ duration: 0.3 }}
                  />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white/80 backdrop-blur-sm border-2 border-gray-900 text-gray-900 hover:bg-gray-100 font-semibold px-8 py-6 text-lg shadow-xl rounded-full"
                  onClick={() => navigate('/dashboard?view=babalawos')}
                >
                  Browse Babalawos
                </Button>
              </motion.div>
            </motion.div>

            {/* Trust Features */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-2 bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-200/50 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.9)" }}
                >
                  <feature.icon className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-900">{feature.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={index}
                    className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 text-center border border-gray-200/50 shadow-lg"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + index * 0.1, type: "spring" }}
                    whileHover={{ y: -5, scale: 1.05 }}
                  >
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${stat.color} p-2 mx-auto mb-2`}>
                      <Icon className="w-full h-full text-white" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                    <div className="text-xs text-gray-600 font-medium">{stat.label}</div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>

          {/* Right Column - Testimonial Carousel */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="relative">
              {/* Decorative elements */}
              <motion.div
                className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-2xl opacity-50"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              <motion.div
                className="absolute -bottom-4 -right-4 w-32 h-32 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full blur-2xl opacity-50"
                animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
                transition={{ duration: 10, repeat: Infinity }}
              />

              {/* Testimonial Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTestimonial}
                  className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-gray-100 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Quote mark */}
                  <div className="absolute top-4 right-4 text-orange-200 text-6xl font-serif">"</div>

                  {/* Stars */}
                  <div className="flex justify-center mb-6">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Star className="w-6 h-6 text-yellow-400 fill-current" />
                      </motion.div>
                    ))}
                  </div>

                  {/* Testimonial text */}
                  <blockquote className="text-lg md:text-xl text-gray-700 mb-8 leading-relaxed text-center font-medium">
                    "{testimonials[currentTestimonial].text}"
                  </blockquote>

                  {/* Author info */}
                  <div className="flex items-center justify-center gap-4 border-t border-gray-100 pt-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {testimonials[currentTestimonial].name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900 text-lg">
                        {testimonials[currentTestimonial].name}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {testimonials[currentTestimonial].location}
                      </p>
                      <p className="text-orange-600 text-xs font-semibold mt-1 flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-current" />
                        {testimonials[currentTestimonial].sessions} sessions completed
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex gap-2 justify-center mt-6">
                    {testimonials.map((_, index) => (
                      <motion.button
                        key={index}
                        className={`h-1.5 rounded-full transition-all ${
                          index === currentTestimonial
                            ? 'w-8 bg-gradient-to-r from-orange-500 to-pink-500'
                            : 'w-1.5 bg-gray-300'
                        }`}
                        onClick={() => setCurrentTestimonial(index)}
                        whileHover={{ scale: 1.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Floating badges */}
              <motion.div
                className="absolute -right-6 top-1/4 bg-green-500 text-white px-4 py-2 rounded-full shadow-xl text-sm font-bold flex items-center gap-2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <TrendingUp className="w-4 h-4" />
                #1 Rated Platform
              </motion.div>

              <motion.div
                className="absolute -left-6 bottom-1/4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-xl text-sm font-bold"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
                whileHover={{ scale: 1.1, rotate: -5 }}
              >
                🔒 100% Secure
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSectionEnhanced;
