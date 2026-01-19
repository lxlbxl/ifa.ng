import React, { useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const testimonials = [
  {
    name: "Adunni Olatunji",
    role: "Regular Client",
    text: "The guidance I received was profound and life-changing. Baba Ifasegun helped me understand my path clearly. I've had three sessions and each one brought new insights into my spiritual journey and personal growth.",
    rating: 5,
    location: "Lagos, Nigeria",
    image: "/testimonials/testimonial-1.jpg",
    sessions: 8
  },
  {
    name: "Michael Thompson",
    role: "Business Professional",
    text: "Professional, authentic, and deeply insightful. I finally found the spiritual guidance I was seeking after trying many other options. The video quality was excellent and the consultation felt very personal.",
    rating: 5,
    location: "New York, USA",
    image: "/testimonials/testimonial-2.jpg",
    sessions: 5
  },
  {
    name: "Fatima Al-Rashid",
    role: "Wellness Practitioner",
    text: "The consultation was exactly what I needed. The Babalawo was patient and provided clear direction. While I was skeptical at first, I'm now a regular client and have recommended the platform to friends.",
    rating: 4,
    location: "Dubai, UAE",
    image: "/testimonials/testimonial-3.jpg",
    sessions: 12
  },
  {
    name: "Carlos Mendoza",
    role: "Entrepreneur",
    text: "I appreciate how the platform connected me with a Babalawo who understood my cultural background. The spiritual insights have helped me navigate a difficult transition in my life and business.",
    rating: 5,
    location: "Mexico City, Mexico",
    image: "/testimonials/testimonial-4.jpg",
    sessions: 6
  },
  {
    name: "Aisha Ibrahim",
    role: "Healthcare Worker",
    text: "Finding authentic spiritual guidance online seemed impossible until I discovered IFA.ng. The verification process gives me confidence, and my Babalawo has been incredibly supportive.",
    rating: 5,
    location: "London, UK",
    image: "/testimonials/testimonial-5.jpg",
    sessions: 10
  }
];

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const current = testimonials[currentIndex];

  return (
    <section className="py-20 bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-primary animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full bg-accent animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Quote className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Clients Say
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real stories from people who found guidance and clarity
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12">
                  {/* Left side - Testimonial content */}
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-6 h-6 ${
                            i < current.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>

                    <blockquote className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
                      "{current.text}"
                    </blockquote>

                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                        {current.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-lg">
                          {current.name}
                        </div>
                        <div className="text-gray-600 text-sm">
                          {current.role} • {current.location}
                        </div>
                        <div className="text-primary text-sm font-medium mt-1">
                          {current.sessions} sessions completed
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side - Visual element */}
                  <div className="hidden md:flex items-center justify-center">
                    <div className="relative">
                      <div className="w-64 h-64 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                        <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center shadow-xl">
                          <Quote className="w-20 h-20 text-primary/30" />
                        </div>
                      </div>
                      <div className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                        <Star className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <button
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-16 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <button
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-16 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-primary w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
