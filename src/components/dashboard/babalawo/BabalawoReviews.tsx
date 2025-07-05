import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Flag, MessageSquare, ThumbsUp, AlertTriangle, Filter, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBabalawoReviews } from '@/hooks/useBabalawoReviews';

interface Review {
  id: string;
  user_id: string;
  babalawo_id: string;
  rating: number;
  comment: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  response?: string;
  flagged?: boolean;
  user?: {
    full_name?: string;
    avatar_url?: string;
  };
}

const StarRating = ({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };
  
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <div key={star} className="relative">
          {/* Empty star background */}
          <Star className={`${sizeClass[size]} text-gray-300`} />
          
          {/* Filled star overlay with clip based on rating */}
          <div 
            className="absolute top-0 left-0 overflow-hidden"
            style={{ 
              width: `${Math.min(100, Math.max(0, (rating - (star - 1)) * 100))}%` 
            }}
          >
            <Star className={`${sizeClass[size]} text-yellow-400 fill-current`} />
          </div>
        </div>
      ))}
    </div>
  );
};

const RatingSummary = ({ reviews }: { reviews: Review[] }) => {
  // Calculate rating distribution
  const ratingCounts = [0, 0, 0, 0, 0]; // 1-5 stars
  
  reviews.forEach(review => {
    if (review.rating >= 1 && review.rating <= 5) {
      ratingCounts[Math.floor(review.rating) - 1]++;
    }
  });
  
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
    : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Rating Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl font-bold text-gray-900">
            {averageRating.toFixed(1)}
          </div>
          <div>
            <StarRating rating={averageRating} size="lg" />
            <p className="text-sm text-gray-500 mt-1">{totalReviews} reviews</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars - 1];
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            
            return (
              <div key={stars} className="flex items-center gap-2">
                <div className="w-12 text-sm text-gray-600">{stars} stars</div>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="w-12 text-sm text-gray-600 text-right">{count}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const ReviewCard = ({ 
  review, 
  onRespond, 
  onFlag 
}: { 
  review: Review; 
  onRespond: (review: Review) => void; 
  onFlag: (review: Review) => void;
}) => {
  const userName = review.user?.full_name || 'Anonymous User';
  const userAvatar = review.user?.avatar_url;
  const formattedDate = format(new Date(review.created_at), 'MMM d, yyyy');
  
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-gray-200">
              <AvatarImage src={userAvatar} />
              <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-gray-900">{userName}</h3>
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-xs text-gray-500">{formattedDate}</span>
              </div>
            </div>
          </div>
          
          <Badge 
            className={
              review.status === 'approved' 
                ? 'bg-green-100 text-green-800' 
                : review.status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }
          >
            {review.status === 'approved' 
              ? 'Approved' 
              : review.status === 'rejected'
              ? 'Rejected'
              : 'Pending'}
          </Badge>
        </div>
        
        <div className="mt-3">
          <p className="text-gray-700">{review.comment}</p>
        </div>
        
        {review.response && (
          <div className="mt-3 bg-gray-50 p-3 rounded-md">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <MessageSquare className="h-4 w-4" />
              <span>Your Response</span>
            </div>
            <p className="text-gray-700">{review.response}</p>
          </div>
        )}
        
        <div className="mt-4 flex gap-2 justify-end">
          {!review.flagged && (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => onFlag(review)}
            >
              <Flag className="h-3 w-3 mr-1" />
              Flag
            </Button>
          )}
          
          {review.flagged && (
            <div className="text-red-600 font-semibold flex items-center space-x-1">
              <CheckCircle className="h-4 w-4" />
              <span>Flagged</span>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={() => onRespond(review)}
            disabled={!!review.response}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            {review.response ? 'Responded' : 'Respond'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const BabalawoReviews = () => {
  const { user } = useAuth();
  const { data: babalawoReviews, isLoading, error } = useBabalawoReviews();
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  useEffect(() => {
    if (babalawoReviews) {
      setFilteredReviews(babalawoReviews);
    }
  }, [babalawoReviews]);
  
  useEffect(() => {
    if (!babalawoReviews) return;
    
    // Apply filters
    let filtered = [...babalawoReviews];
    
    // Filter by rating
    if (filterRating !== 'all') {
      const rating = parseInt(filterRating);
      filtered = filtered.filter(review => Math.floor(review.rating) === rating);
    }
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(review => review.status === filterStatus);
    }
    
    setFilteredReviews(filtered);
  }, [babalawoReviews, filterRating, filterStatus]);
  
  const handleRespond = (review: Review) => {
    setSelectedReview(review);
    setResponseText(review.response || '');
    setResponseDialogOpen(true);
  };
  
  const handleFlag = (review: Review) => {
    setSelectedReview(review);
    setFlagReason('');
    setFlagDialogOpen(true);
  };
  
  const submitResponse = async () => {
    if (!selectedReview || !responseText.trim()) return;
    
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ response: responseText.trim() })
        .eq('id', selectedReview.id);
      
      if (error) throw error;
      
      toast({
        title: 'Response submitted',
        description: 'Your response has been added to the review'
      });
      
      setResponseDialogOpen(false);
      
      // Refresh the reviews data
      window.location.reload();
    } catch (err) {
      console.error('Error submitting response:', err);
      toast({
        title: 'Error',
        description: 'Failed to submit response',
        variant: 'destructive'
      });
    }
  };
  
  const submitFlag = async () => {
    if (!selectedReview || !flagReason.trim()) return;
    
    try {
      // Update the review as flagged
      const { error } = await supabase
        .from('reviews')
        .update({ flagged: true })
        .eq('id', selectedReview.id);
      
      if (error) throw error;
      
      // Create a flag record
      const { error: flagError } = await supabase
        .from('review_flags')
        .insert({
          review_id: selectedReview.id,
          reason: flagReason.trim(),
          reporter_id: user?.id,
          reporter_type: 'babalawo'
        });
      
      if (flagError) throw flagError;
      
      toast({
        title: 'Review flagged',
        description: 'This review has been flagged for admin review'
      });
      
      setFlagDialogOpen(false);
      
      // Refresh the reviews data
      window.location.reload();
    } catch (err) {
      console.error('Error flagging review:', err);
      toast({
        title: 'Error',
        description: 'Failed to flag review',
        variant: 'destructive'
      });
    }
  };
  
  const topReviews = babalawoReviews
    ? babalawoReviews
        .filter(r => r.rating >= 4 && !r.flagged && r.status === 'approved')
        .slice(0, 3)
    : [];
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3" />
        <h3 className="text-lg font-medium">Error loading reviews</h3>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Reviews & Ratings</h1>
        <div className="flex gap-2">
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <RatingSummary reviews={babalawoReviews || []} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-xl">Review Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <ThumbsUp className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Responding to Reviews</h3>
                  <p className="text-sm text-gray-600">
                    Respond professionally to all reviews, especially negative ones. 
                    This shows you value client feedback.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Flagging Reviews</h3>
                  <p className="text-sm text-gray-600">
                    Flag reviews that contain offensive language, personal attacks, 
                    or false information for admin review.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Star className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Review Status</h3>
                  <p className="text-sm text-gray-600">
                    Reviews with 3+ stars are automatically approved. 
                    Lower ratings require admin approval before becoming public.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Top Reviews Section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-xl">Top Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {topReviews.length === 0 ? (
                <p className="text-gray-500">No top reviews available.</p>
              ) : (
                topReviews.map(review => (
                  <div key={review.id} className="border-b py-4">
                    <p className="italic">"{review.comment}"</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-sm text-gray-500">
                        - {review.user?.full_name || 'Anonymous User'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-500">No reviews found</h3>
              <p className="text-gray-400 text-sm mt-1">
                {filterRating !== 'all' || filterStatus !== 'all' 
                  ? 'Try changing your filters to see more reviews' 
                  : 'You haven\'t received any reviews yet'}
              </p>
            </div>
          ) : (
            filteredReviews.map(review => (
              <ReviewCard 
                key={review.id} 
                review={review} 
                onRespond={handleRespond} 
                onFlag={handleFlag} 
              />
            ))
          )}
        </div>
      </div>
      
      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Your response will be visible to all users. Be professional and helpful.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={selectedReview?.rating || 0} size="sm" />
                <span className="text-sm text-gray-500">
                  {selectedReview?.user?.full_name || 'Anonymous User'}
                </span>
              </div>
              <p className="text-gray-700">{selectedReview?.comment}</p>
            </div>
            
            <Textarea
              placeholder="Type your response here..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={4}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitResponse} disabled={!responseText.trim()}>
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Flag Dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Review</DialogTitle>
            <DialogDescription>
              Flag this review for admin review if it contains inappropriate content.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={selectedReview?.rating || 0} size="sm" />
                <span className="text-sm text-gray-500">
                  {selectedReview?.user?.full_name || 'Anonymous User'}
                </span>
              </div>
              <p className="text-gray-700">{selectedReview?.comment}</p>
            </div>
            
            <Select onValueChange={setFlagReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason for flagging" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offensive">Contains offensive language</SelectItem>
                <SelectItem value="spam">Spam or irrelevant content</SelectItem>
                <SelectItem value="false">Contains false information</SelectItem>
                <SelectItem value="personal">Personal attack</SelectItem>
                <SelectItem value="other">Other reason</SelectItem>
              </SelectContent>
            </Select>
            
            {flagReason === 'other' && (
              <Textarea
                placeholder="Please explain why you're flagging this review..."
                className="mt-4"
                rows={3}
                onChange={(e) => setFlagReason(e.target.value)}
              />
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={submitFlag} 
              disabled={!flagReason}
              variant="destructive"
            >
              Flag Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BabalawoReviews;
