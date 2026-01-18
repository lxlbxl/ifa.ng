import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    question: "How do I book a consultation?",
    answer: "Simply browse our verified Babalawos, select one that matches your needs, choose an available time slot, and complete the secure payment. You'll receive instant confirmation and reminders before your session."
  },
  {
    question: "Are the Babalawos verified and authentic?",
    answer: "Yes! All our Babalawos undergo a rigorous verification process. We verify their credentials, experience, and authenticity before they can join our platform. Each profile shows their years of experience, specialties, and verified status."
  },
  {
    question: "How secure are the video consultations?",
    answer: "We use enterprise-grade encryption for all video sessions. Your consultations are completely private and confidential. We never record sessions without explicit consent, and all data is protected by industry-leading security standards."
  },
  {
    question: "What if I'm not satisfied with my consultation?",
    answer: "Your satisfaction is our priority. If you're not completely satisfied with your consultation, contact our support team within 24 hours. We offer refunds or credits for future sessions based on your situation."
  },
  {
    question: "Can I reschedule or cancel a booking?",
    answer: "Yes, you can reschedule or cancel your booking up to 24 hours before the scheduled time for a full refund. Cancellations made within 24 hours may be subject to a cancellation fee."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major payment methods including credit/debit cards, bank transfers, and mobile money. All transactions are processed through secure, PCI-compliant payment gateways."
  },
  {
    question: "How long does a typical consultation last?",
    answer: "Standard consultations are 30 minutes, but you can book longer sessions (60 or 90 minutes) based on your needs. The duration is shown when you select your Babalawo."
  },
  {
    question: "Do I need any special equipment for video sessions?",
    answer: "You just need a device with a camera and microphone (smartphone, tablet, or computer) and a stable internet connection. Our platform works on all modern browsers - no downloads required."
  }
];

const FAQItem: React.FC<{ faq: typeof faqs[0]; isOpen: boolean; onToggle: () => void }> = ({
  faq,
  isOpen,
  onToggle
}) => {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onToggle}
        className="w-full py-5 px-6 text-left flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-gray-900 text-lg flex-1">{faq.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-shrink-0 mt-1"
        >
          <ChevronDown className="w-5 h-5 text-primary" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-gray-600 leading-relaxed">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 bg-gradient-to-br from-white to-orange-50">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about our platform and services
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <a
            href="/support"
            className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
          >
            Contact our support team
            <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
