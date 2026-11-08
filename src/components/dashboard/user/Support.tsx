import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  HelpCircle, 
  MessageSquare, 
  AlertTriangle, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Mail,
  Phone,
  ExternalLink,
  Flag
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/hooks/useAuth';

const Support = () => {
  const { userProfile } = useAuth();
  const [contactFormData, setContactFormData] = useState({
    subject: '',
    message: '',
    email: userProfile?.email || '',
  });

  const handleContactFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContactFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit form logic would go here
    alert('Support request submitted. We will get back to you soon!');
    setContactFormData({
      subject: '',
      message: '',
      email: userProfile?.email || '',
    });
  };

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <HelpCircle className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold text-gray-800">Support & Help</h2>
      </div>

      <Tabs defaultValue="faq" className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="faq">FAQs</TabsTrigger>
          <TabsTrigger value="contact">Contact Us</TabsTrigger>
          <TabsTrigger value="report">Report an Issue</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I book a session with a Babalawo?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      You can book a session by navigating to the "Find Babalawo" section, browsing available Babalawos, 
                      and clicking the "Book Now" button on their profile. You'll then be able to select a date and time 
                      for your session and complete the payment.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger>What payment methods are accepted?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      We accept various payment methods including credit/debit cards, bank transfers, and mobile money. 
                      You can also add funds to your wallet and use your wallet balance to pay for sessions.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger>How do I join a virtual session?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      When it's time for your session, go to the "Upcoming Sessions" section on your dashboard. 
                      The "Join Session" button will become active 10 minutes before the scheduled time. Click it 
                      to enter the virtual consultation room.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4">
                  <AccordionTrigger>Can I reschedule or cancel my session?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      Yes, you can reschedule or cancel a session up to 24 hours before the scheduled time. 
                      Go to "My Sessions" and find the session you want to modify. For cancellations less than 
                      24 hours before, a cancellation fee may apply.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-5">
                  <AccordionTrigger>How are Babalawos verified on the platform?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      All Babalawos on our platform go through a rigorous verification process. This includes 
                      verification of their credentials, background checks, and interviews. Verified Babalawos 
                      have a verification badge on their profile.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-6">
                  <AccordionTrigger>What if I'm not satisfied with my session?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      If you're not satisfied with your session, please contact our support team within 48 hours. 
                      We take all feedback seriously and will work with you to resolve any issues. In some cases, 
                      we may offer a partial or full refund.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-7">
                  <AccordionTrigger>How do I earn and redeem loyalty points?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600">
                      You earn IFA Points by completing sessions, writing reviews, referring friends, and more. 
                      You can view your points and available rewards in the "Loyalty & Rewards" section. 
                      Points can be redeemed for discounts, free sessions, and other benefits.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <form onSubmit={handleContactFormSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={contactFormData.email}
                        onChange={handleContactFormChange}
                        placeholder="Your email address"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Subject</label>
                      <Input
                        id="subject"
                        name="subject"
                        value={contactFormData.subject}
                        onChange={handleContactFormChange}
                        placeholder="What is your inquiry about?"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                      <Textarea
                        id="message"
                        name="message"
                        value={contactFormData.message}
                        onChange={handleContactFormChange}
                        placeholder="Please describe your issue or question in detail"
                        rows={5}
                        required
                      />
                    </div>
                    
                    <Button type="submit" className="w-full">
                      Submit Request
                    </Button>
                  </form>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium text-gray-800 mb-3">Other Ways to Reach Us</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-700">Email Support</h4>
                          <p className="text-sm text-gray-600">support@ifa.ng</p>
                          <p className="text-xs text-gray-500 mt-1">Response time: Within 24 hours</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-700">Phone Support</h4>
                          <p className="text-sm text-gray-600">+234 (0) 123 456 7890</p>
                          <p className="text-xs text-gray-500 mt-1">Available: Mon-Fri, 9am-5pm WAT</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-700">WhatsApp Support</h4>
                          <p className="text-sm text-gray-600">+234 (0) 987 654 3210</p>
                          <Button variant="outline" size="sm" className="mt-2 h-8 text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            Chat on WhatsApp
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-800 mb-2">Support Hours</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex justify-between">
                        <span>Monday - Friday:</span>
                        <span>9:00 AM - 5:00 PM WAT</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Saturday:</span>
                        <span>10:00 AM - 2:00 PM WAT</span>
                      </li>
                      <li className="flex justify-between">
                        <span>Sunday:</span>
                        <span>Closed</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report an Issue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-auto py-6 flex flex-col items-center justify-center gap-2">
                    <Flag className="h-6 w-6 text-red-500" />
                    <span className="font-medium">Report a Babalawo</span>
                    <span className="text-xs text-gray-500">Report unprofessional behavior</span>
                  </Button>
                  
                  <Button variant="outline" className="h-auto py-6 flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                    <span className="font-medium">Dispute a Session</span>
                    <span className="text-xs text-gray-500">If you had issues with a session</span>
                  </Button>
                  
                  <Button variant="outline" className="h-auto py-6 flex flex-col items-center justify-center gap-2">
                    <FileText className="h-6 w-6 text-blue-500" />
                    <span className="font-medium">Payment Issue</span>
                    <span className="text-xs text-gray-500">Report problems with payments</span>
                  </Button>
                  
                  <Button variant="outline" className="h-auto py-6 flex flex-col items-center justify-center gap-2">
                    <HelpCircle className="h-6 w-6 text-purple-500" />
                    <span className="font-medium">Technical Support</span>
                    <span className="text-xs text-gray-500">Report bugs or technical issues</span>
                  </Button>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-800 mb-1">Important Note</h3>
                      <p className="text-sm text-yellow-700">
                        All reports are treated confidentially and investigated thoroughly. We take all issues seriously 
                        and will respond to your report within 24-48 hours. For urgent matters, please contact us directly 
                        via phone or WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policies & Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Refund Policy</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>
                          We offer refunds under the following circumstances:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Technical issues that prevented the session from taking place</li>
                          <li>Babalawo cancellation without rescheduling</li>
                          <li>Session quality issues (subject to review)</li>
                        </ul>
                        <p>
                          Refund requests must be submitted within 48 hours of the scheduled session. 
                          Refunds typically process within 5-7 business days.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Cancellation Policy</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>
                          Our cancellation policy is as follows:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Cancellations more than 24 hours before: Full refund</li>
                          <li>Cancellations 12-24 hours before: 50% refund</li>
                          <li>Cancellations less than 12 hours before: No refund</li>
                          <li>No-shows: No refund</li>
                        </ul>
                        <p>
                          Exceptions may be made for emergencies with proper documentation.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Privacy Policy</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>
                          We take your privacy seriously. We collect only the information necessary to provide our services.
                          This includes:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Personal information (name, email, phone number)</li>
                          <li>Payment information (processed securely through our payment providers)</li>
                          <li>Session details and history</li>
                        </ul>
                        <p>
                          We never share your personal information with third parties except as required to provide our services.
                          For the full privacy policy, please visit our website.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-4">
                    <AccordionTrigger>Terms of Service</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>
                          By using our platform, you agree to our Terms of Service, which include:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Treating Babalawos and other users with respect</li>
                          <li>Not using the platform for illegal or harmful purposes</li>
                          <li>Providing accurate information when creating your account</li>
                          <li>Accepting that spiritual guidance is not a substitute for professional medical, legal, or financial advice</li>
                        </ul>
                        <Button variant="link" className="p-0 h-auto text-primary">
                          Read Full Terms of Service
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <div className="flex justify-center gap-4">
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    <span>Terms of Service</span>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    <span>Privacy Policy</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Support;
