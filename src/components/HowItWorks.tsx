
import { Calendar, Video, Star } from "lucide-react";

const steps = [
  {
    icon: Calendar,
    title: "Choose Your Babalawo",
    description: "Browse verified spiritual guides, check their specialties, ratings, and availability to find the perfect match for your needs.",
    color: "text-primary"
  },
  {
    icon: Video,
    title: "Book & Connect",
    description: "Schedule your consultation, make secure payment, and join your private audio or video session at the appointed time.",
    color: "text-secondary"
  },
  {
    icon: Star,
    title: "Receive Guidance",
    description: "Get authentic spiritual insights, personalized advice, and transformative guidance from experienced Babalawos.",
    color: "text-accent"
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 bg-gradient-warm">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            How IFA Connect Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your journey to spiritual enlightenment is just three simple steps away
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-primary to-secondary transform translate-x-4 -translate-y-1/2 z-0"></div>
              )}
              
              <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 relative z-10 animate-fade-in" style={{animationDelay: `${index * 0.2}s`}}>
                <div className={`w-16 h-16 ${step.color} bg-opacity-10 rounded-full flex items-center justify-center mb-6 mx-auto`}>
                  <step.icon className={`w-8 h-8 ${step.color}`} />
                </div>
                
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Step Number */}
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center bg-white rounded-full px-6 py-3 shadow-md">
            <span className="text-gray-700 mr-2">Ready to begin?</span>
            <button className="bg-gradient-primary text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 transition-opacity">
              Start Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
