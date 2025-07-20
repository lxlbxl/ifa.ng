import React, { useState } from 'react';
import { useUserSessions } from '@/hooks/useUserSessions';
import { 
  Calendar, 
  Clock, 
  User, 
  Star, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  DollarSign, 
  ShoppingBag, 
  AlertCircle, 
  CalendarClock,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';

interface SessionDetails {
  primaryOdu?: string;
  otherOdus?: string[];
  ritualRecommendations?: string;
  itemsNeeded?: { name: string; cost: number }[];
  totalCost?: number;
  deadline?: string;
  nextAppointment?: string;
  rating?: number;
  review?: string;
}

// Mock session details data (in a real app, this would come from the API)
const mockSessionDetails: { [key: string]: SessionDetails } = {
  '1': {
    primaryOdu: 'Ogbe Meji',
    otherOdus: ['Oyeku Meji', 'Iwori Meji'],
    ritualRecommendations: 'Morning prayers with white candles for 7 days. Offering of fruits to Oshun.',
    itemsNeeded: [
      { name: 'White candles (7)', cost: 2000 },
      { name: 'Fresh fruits assortment', cost: 3500 },
      { name: 'Honey', cost: 1500 },
      { name: 'White cloth', cost: 5000 }
    ],
    totalCost: 12000,
    deadline: '2025-07-01',
    nextAppointment: '2025-07-15',
    rating: 5,
    review: 'Excellent session. The Babalawo was very knowledgeable and provided clear guidance.'
  },
  '2': {
    primaryOdu: 'Irosun Meji',
    otherOdus: ['Owonrin Meji'],
    ritualRecommendations: 'Cleansing bath with herbs for 3 consecutive days. Prayers to Ogun.',
    itemsNeeded: [
      { name: 'Special herbs mix', cost: 7500 },
      { name: 'Red candles (3)', cost: 1500 },
      { name: 'Palm oil', cost: 2000 }
    ],
    totalCost: 11000,
    deadline: '2025-06-30',
    nextAppointment: '2025-07-10',
    rating: 4
  }
};

const SessionHistory = () => {
  const { data: sessions, isLoading, error } = useUserSessions();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [reviewData, setReviewData] = useState({ rating: 0, comment: '' });

  const toggleExpand = (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionId);
    }
  };

  const handleReviewClick = (session: any) => {
    setSelectedSession(session);
    setReviewData({
      rating: mockSessionDetails[session.id]?.rating || 0,
      comment: mockSessionDetails[session.id]?.review || ''
    });
    setShowReviewDialog(true);
  };

  const submitReview = () => {
    // In a real app, this would send the review to the API
    alert('Review submitted successfully!');
    setShowReviewDialog(false);
  };

  const handleRating = (rating: number) => {
    setReviewData({ ...reviewData, rating });
  };

  if (isLoading) {
    return (
      <div className="bg-white/50 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Session History</h2>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/50 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Session History</h2>
        <div className="text-red-500">Error loading session history: {error.message}</div>
      </div>
    );
  }

  const completedSessions = sessions?.filter(session => 
    session.status === 'completed' || new Date(session.session_date) < new Date()
  ) || [];

  const filteredSessions = activeTab === 'all' 
    ? completedSessions 
    : completedSessions.filter(session => session.status === activeTab);

  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Your Past Sessions</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            Export History
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="all" className="mb-6" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="missed">Missed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {filteredSessions.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No {activeTab === 'all' ? 'completed' : activeTab} sessions</h3>
          <p className="text-gray-400">Your {activeTab === 'all' ? 'completed' : activeTab} sessions will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSessions.map((session) => {
            const sessionDetails = mockSessionDetails[session.id] || {};
            const isExpanded = expandedSession === String(session.id);
            
            return (
              <Card key={session.id} className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-md' : 'shadow-sm'}`}>
                <div className="bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                       {(() => { console.log('[SessionHistory] session.babalawo.profile:', session.babalawo_name); return null; })()}
                       <h3 className="font-semibold text-gray-800">
                         {session.babalawo_name || 'Babalawo (Name Missing)'}
                       </h3>
                         <p className="text-sm text-gray-500 mb-2">
                           {session.babalawo_specialties?.join(', ') || 'General consultation'}
                         </p>
                        <div className="flex items-center text-sm text-gray-600 space-x-4">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {format(new Date(session.session_date), 'MMM dd, yyyy')}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {session.start_time} - {session.end_time}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`h-4 w-4 ${star <= (sessionDetails.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                      <Badge 
                        className={`
                          ${session.status === 'completed' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 
                            session.status === 'cancelled' ? 'bg-red-100 text-red-800 hover:bg-red-200' : 
                            'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                        `}
                      >
                        {session.status === 'completed' ? 'Completed' : 
                         session.status === 'cancelled' ? 'Cancelled' : 
                         'Completed'}
                      </Badge>
                    </div>
                  </div>
                  
                  {session.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Session Notes:</strong> {session.notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        <Download className="h-3 w-3 mr-1" />
                        Transcript
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-8"
                        onClick={() => handleReviewClick(session)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {sessionDetails.review ? 'Edit Review' : 'Write Review'}
                      </Button>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-8"
                      onClick={() => toggleExpand(String(session.id))}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          View Details
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-primary" />
                            Consultation Outcome
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <h5 className="text-sm font-medium text-gray-600 mb-1">Primary Odu</h5>
                              <p className="text-sm bg-primary/5 p-2 rounded">
                                {sessionDetails.primaryOdu || 'Not recorded'}
                              </p>
                            </div>
                            
                            {sessionDetails.otherOdus && sessionDetails.otherOdus.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Other Odu</h5>
                                <div className="flex flex-wrap gap-2">
                                  {sessionDetails.otherOdus.map((odu, index) => (
                                    <Badge key={index} variant="outline" className="bg-gray-50">
                                      {odu}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <h5 className="text-sm font-medium text-gray-600 mb-1">Ebo/Etutu (Ritual) Recommended</h5>
                              <p className="text-sm bg-orange-50 p-2 rounded text-gray-700">
                                {sessionDetails.ritualRecommendations || 'No specific rituals recommended'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                            <ShoppingBag className="h-4 w-4 mr-2 text-primary" />
                            Items & Next Steps
                          </h4>
                          <div className="space-y-4">
                            {sessionDetails.itemsNeeded && sessionDetails.itemsNeeded.length > 0 ? (
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Items Needed</h5>
                                <div className="bg-gray-50 p-3 rounded">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-gray-500">
                                        <th className="pb-2">Item</th>
                                        <th className="pb-2 text-right">Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sessionDetails.itemsNeeded.map((item, index) => (
                                        <tr key={index} className="border-t border-gray-200">
                                          <td className="py-2">{item.name}</td>
                                          <td className="py-2 text-right">₦{item.cost.toLocaleString()}</td>
                                        </tr>
                                      ))}
                                      {sessionDetails.totalCost && (
                                        <tr className="border-t border-gray-300">
                                          <td className="py-2 font-medium">Total</td>
                                          <td className="py-2 text-right font-medium">₦{sessionDetails.totalCost.toLocaleString()}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1">Items Needed</h5>
                                <p className="text-sm text-gray-500">No specific items required</p>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1 flex items-center">
                                  <AlertCircle className="h-3 w-3 mr-1 text-red-500" /> Deadline
                                </h5>
                                <p className="text-sm">
                                  {sessionDetails.deadline 
                                    ? format(new Date(sessionDetails.deadline), 'MMM dd, yyyy')
                                    : 'Flexible / Not specified'}
                                </p>
                              </div>
                              
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 mb-1 flex items-center">
                                  <CalendarClock className="h-3 w-3 mr-1 text-blue-500" /> Next Appointment
                                </h5>
                                <p className="text-sm">
                                  {sessionDetails.nextAppointment 
                                    ? format(new Date(sessionDetails.nextAppointment), 'MMM dd, yyyy')
                                    : 'Not scheduled'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button variant="default" size="sm">
                          Book Follow-up Session
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mockSessionDetails[selectedSession?.id]?.review ? 'Edit Your Review' : 'Write a Review'}
            </DialogTitle>
            <DialogDescription>
              Share your experience with {selectedSession?.babalawo?.profile?.full_name || 'the Babalawo'}.
              Your feedback helps others in their spiritual journey.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Your Rating</h4>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => handleRating(star)}
                    className="focus:outline-none"
                  >
                    <Star 
                      className={`h-8 w-8 ${star <= reviewData.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Your Review</h4>
              <Textarea 
                placeholder="Share your experience with this Babalawo..."
                value={reviewData.comment}
                onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                rows={5}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button onClick={submitReview} disabled={reviewData.rating === 0}>Submit Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SessionHistory;
