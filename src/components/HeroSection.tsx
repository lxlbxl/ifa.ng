
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Star, Shield, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

const testimonials = [
  {
    name: "Adunni Olatunji",
    text: "The guidance I received was profound and life-changing. Baba Ifasegun helped me understand my path clearly. I've had three sessions and each one brought new insights.",
    rating: 5,
    location: "Lagos, Nigeria",
    image: "/public/testimonials/testimonial-1.jpg"
  },
  {
    name: "Michael Thompson",
    text: "Professional, authentic, and deeply insightful. I finally found the spiritual guidance I was seeking after trying many other options. The video quality was excellent.",
    rating: 4.5,
    location: "New York, USA",
    image: "/public/testimonials/testimonial-2.jpg"
  },
  {
    name: "Fatima Al-Rashid",
    text: "The consultation was exactly what I needed. The Babalawo was patient and provided clear direction. While I was skeptical at first, I'm now a regular client.",
    rating: 4,
    location: "Dubai, UAE",
    image: "/public/testimonials/testimonial-3.jpg"
  },
  {
    name: "Carlos Mendoza",
    text: "I appreciate how the platform connected me with a Babalawo who understood my cultural background. The spiritual insights have helped me navigate a difficult transition in my life.",
    rating: 5,
    location: "Mexico City, Mexico",
    image: "/public/testimonials/testimonial-4.jpg"
  }
];

const HeroSection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="home" className="relative overflow-hidden bg-gradient-hero min-h-screen flex items-center">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-white animate-float"></div>
        <div className="absolute bottom-20 right-10 w-24 h-24 rounded-full bg-white animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 rounded-full bg-white animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Hero Content */}
          <div className="text-center lg:text-left animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Seek Guidance from{" "}
              <span className="text-gray-900 bg-yellow-400 px-2 py-1 rounded-lg shadow-lg">
                Verified Babalawos
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-900 font-semibold mb-8 max-w-2xl bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
              Connect with authentic spiritual guides for life-changing consultations through secure audio and video sessions. Your path to wisdom starts here.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Button
                size="lg"
                className="bg-gray-900 text-white hover:bg-gray-800 font-semibold px-8 py-4 text-lg shadow-xl border-2 border-gray-900"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Book Consultation
              </Button>
              <Button
                size="lg"
                className="bg-white text-gray-900 hover:bg-gray-100 font-semibold px-8 py-4 text-lg shadow-xl border-2 border-gray-900 transition-all duration-300"
                onClick={() => navigate('/dashboard?view=babalawos')}
              >
                Browse Babalawos
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-6">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-gray-900 shadow-lg">
                <Shield className="w-5 h-5 text-gray-900" />
                <span className="text-sm font-bold text-gray-900">100% Verified</span>
              </div>
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-gray-900 shadow-lg">
                <Video className="w-5 h-5 text-gray-900" />
                <span className="text-sm font-bold text-gray-900">Secure Sessions</span>
              </div>
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 border-2 border-gray-900 shadow-lg">
                <Star className="w-5 h-5 fill-current text-gray-900" />
                <span className="text-sm font-bold text-gray-900">5.0 Average Rating</span>
              </div>
            </div>
          </div>

          {/* Right Column - Testimonial Carousel */}
          <div className="relative animate-fade-in" style={{animationDelay: '0.3s'}}>
            <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {/* Dynamic star rating that shows partial stars */}
                  {[1, 2, 3, 4, 5].map((star) => {
                    const rating = testimonials[currentTestimonial].rating;
                    return (
                      <div key={star} className="relative">
                        {/* Empty star background */}
                        <Star className="w-6 h-6 text-gray-300" />
                        
                        {/* Filled star overlay with clip based on rating */}
                        <div 
                          className="absolute top-0 left-0 overflow-hidden"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (rating - (star - 1)) * 100))}%` 
                          }}
                        >
                          <Star className="w-6 h-6 text-accent fill-current" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <blockquote className="text-lg text-gray-800 mb-6 leading-relaxed">
                  "{testimonials[currentTestimonial].text}"
                </blockquote>
                
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-center gap-3">
                    {testimonials[currentTestimonial].image && (
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <img 
                          src={testimonials[currentTestimonial].image} 
                          alt={testimonials[currentTestimonial].name}
                          className="w-full h-full object-cover"
                          width={40}
                          height={40}
                          loading="lazy"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {testimonials[currentTestimonial].name}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {testimonials[currentTestimonial].location}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial Indicators */}
            <div className="flex justify-center mt-6 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentTestimonial ? 'bg-gray-800 shadow-lg' : 'bg-gray-400'
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
