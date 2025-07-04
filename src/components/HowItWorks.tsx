import { Calendar, Video, Star, Search, CreditCard, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    icon: Search,
    title: "Choose Your Babalawo",
    description: "Browse our directory of verified spiritual guides. Filter by specialties, read reviews, and find the perfect match for your spiritual needs.",
    details: [
      "50+ verified Babalawos",
      "Filter by specialty and language",
      "Read authentic reviews",
      "Check availability in your timezone"
    ],
    color: "text-primary"
  },
  {
    icon: Calendar,
    title: "Book & Connect",
    description: "Schedule your consultation at a time that works for you. Make a secure payment and receive instant confirmation of your booking.",
    details: [
      "Flexible scheduling options",
      "Secure payment processing",
      "Instant booking confirmation",
      "Email and SMS reminders"
    ],
    color: "text-secondary"
  },
  {
    icon: Video,
    title: "Receive Guidance",
    description: "Join your private HD video session at the appointed time. Receive personalized spiritual guidance and insights from your chosen Babalawo.",
    details: [
      "High-quality video connection",
      "Complete privacy and confidentiality",
      "Personalized spiritual readings",
      "Post-session guidance notes"
    ],
    color: "text-accent"
  }
];

const HowItWorks = () => {
  const navigate = useNavigate();
  
  const handleStartNow = () => {
    navigate('/auth?tab=signup');
  };
  
  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-br from-orange-50 to-pink-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How IFA.ng Works
          </h2>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
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
              
              <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 relative z-10 animate-fade-in border border-gray-100 h-full flex flex-col" style={{animationDelay: `${index * 0.2}s`}}>
                <div className={`w-16 h-16 ${step.color} bg-opacity-10 rounded-full flex items-center justify-center mb-6 mx-auto`}>
                  <step.icon className={`w-8 h-8 ${step.color}`} />
                </div>
                
                <div className="text-center flex-grow">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {step.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-6">
                    {step.description}
                  </p>
                  
                  {/* Detailed list */}
                  <ul className="text-left space-y-2 mt-auto">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Step Number */}
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  {index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="inline-flex flex-col sm:flex-row items-center bg-white rounded-xl px-8 py-6 shadow-lg border border-gray-200">
            <div className="mb-4 sm:mb-0 sm:mr-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Ready to begin your spiritual journey?</h3>
              <p className="text-gray-600">Join thousands who have found guidance through IFA.ng</p>
            </div>
            <button 
              onClick={handleStartNow}
              className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-105 flex items-center"
            >
              <Clock className="w-5 h-5 mr-2" />
              Start Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;