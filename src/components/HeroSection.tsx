
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Star, Shield, Video } from "lucide-react";

const testimonials = [
  {
    name: "Adunni Olatunji",
    text: "The guidance I received was profound and life-changing. Baba Ifasegun helped me understand my path clearly.",
    rating: 5,
    location: "Lagos, Nigeria"
  },
  {
    name: "Michael Thompson",
    text: "Professional, authentic, and deeply insightful. I finally found the spiritual guidance I was seeking.",
    rating: 5,
    location: "New York, USA"
  },
  {
    name: "Fatima Al-Rashid",
    text: "The consultation was exactly what I needed. The Babalawo was patient and provided clear direction.",
    rating: 5,
    location: "Dubai, UAE"
  }
];

const HeroSection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

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
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
              Seek Guidance from{" "}
              <span className="bg-gradient-to-r from-accent to-warm-light bg-clip-text text-transparent drop-shadow-lg">
                Verified Babalawos
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl drop-shadow">
              Connect with authentic spiritual guides for life-changing consultations through secure audio and video sessions. Your path to wisdom starts here.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold px-8 py-4 text-lg border border-primary shadow">
                Book Consultation
              </Button>
              <Button size="lg" variant="outline" className="border-white text-primary hover:bg-white hover:text-primary font-semibold px-8 py-4 text-lg bg-white/90 hover:bg-white shadow">
                Browse Babalawos
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium drop-shadow">100% Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                <span className="text-sm font-medium drop-shadow">Secure Sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-current" />
                <span className="text-sm font-medium drop-shadow">5.0 Average Rating</span>
              </div>
            </div>
          </div>

          {/* Right Column - Testimonial Carousel */}
          <div className="relative animate-fade-in" style={{animationDelay: '0.3s'}}>
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 border border-white/30">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-6 h-6 text-accent fill-current" />
                  ))}
                </div>
                
                <blockquote className="text-lg text-gray-800 mb-6 leading-relaxed">
                  "{testimonials[currentTestimonial].text}"
                </blockquote>
                
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-900">
                    {testimonials[currentTestimonial].name}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {testimonials[currentTestimonial].location}
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial Indicators */}
            <div className="flex justify-center mt-6 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentTestimonial ? 'bg-primary' : 'bg-gray-300'
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
