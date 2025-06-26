import React, { useState, useMemo } from 'react';
import { useBabalawoReviews } from '@/hooks/useBabalawoReviews';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Flag, MessageCircle, CheckCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const starOptions = [5, 4, 3, 2, 1];

const BabalawoReviews = () => {
  const { data: babalawoReviews, isLoading: loading, error } = useBabalawoReviews();
  const [filterStar, setFilterStar] = useState<number | null>(null);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [responseText, setResponseText] = useState('');
  const { toast } = useToast();

  const filteredReviews = useMemo(() => {
    if (!babalawoReviews) return [];
    if (filterStar === null) return babalawoReviews;
    return babalawoReviews.filter(r => r.rating === filterStar);
  }, [babalawoReviews, filterStar]);

  const topReviews = useMemo(() => {
    if (!babalawoReviews) return [];
    return babalawoReviews
      .filter(r => r.rating >= 4 && !r.flagged)
      .slice(0, 3);
  }, [babalawoReviews]);

  const handleFlagReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ flagged: true } as any)
        .eq('id', reviewId);
      if (error) throw error;
      toast({ title: 'Review flagged', description: 'The review has been flagged for admin review.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to flag review.' });
    }
  };

  const handleRespond = async () => {
    if (!selectedReview) return;
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ response: responseText } as any)
        .eq('id', selectedReview.id);
      if (error) throw error;
      toast({ title: 'Response saved', description: 'Your response has been saved.' });
      setSelectedReview(null);
      setResponseText('');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save response.' });
    }
  };

  if (loading) return <div>Loading reviews...</div>;
  if (error) return <div>Error loading reviews: {error?.message || String(error)}</div>;

  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Star Rating Summary</CardTitle>
          <div className="flex space-x-2 mt-2">
            <Button variant={filterStar === null ? 'default' : 'outline'} onClick={() => setFilterStar(null)}>All</Button>
            {starOptions.map(star => (
              <Button
                key={star}
                variant={filterStar === star ? 'default' : 'outline'}
                onClick={() => setFilterStar(star)}
                className="flex items-center space-x-1"
              >
                <Star className="w-4 h-4 text-yellow-400" />
                <span>{star}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReviews.length === 0 ? (
            <p>No reviews found for selected filter.</p>
          ) : (
            filteredReviews.map(review => (
              <div key={review.id} className="border-b py-4 flex space-x-4">
                <Avatar className="h-12 w-12">
                  {review.user?.avatar_url ? (
                    <AvatarImage src={review.user.avatar_url} />
                  ) : (
                    <AvatarFallback>{review.user?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold">{review.user?.full_name || 'User'}</h4>
                    <div className="flex items-center space-x-1">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`w-4 h-4 ${i <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1">{review.comment}</p>
                  {review.response && (
                    <div className="mt-2 p-2 bg-gray-100 rounded">
                      <strong>Response:</strong> {review.response}
                    </div>
                  )}
                  <div className="mt-2 flex space-x-2">
                    <Button size="sm" onClick={() => { setSelectedReview(review); setResponseText(review.response || ''); }}>
                      <MessageCircle className="w-4 h-4 mr-1" /> Respond
                    </Button>
                    {!review.flagged && (
                      <Button size="sm" variant="destructive" onClick={() => handleFlagReview(review.id)}>
                        <Flag className="w-4 h-4 mr-1" /> Flag
                      </Button>
                    )}
                    {review.flagged && (
                      <div className="text-red-600 font-semibold flex items-center space-x-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>Flagged</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Response Dialog */}
      {selectedReview && (
        <Dialog open={true} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Respond to Review</DialogTitle>
            </DialogHeader>
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Write your response here..."
              rows={5}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReview(null)}>Cancel</Button>
              <Button onClick={handleRespond}>Save Response</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Top Reviews Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {topReviews.length === 0 ? (
            <p>No top reviews available.</p>
          ) : (
            topReviews.map(review => (
              <div key={review.id} className="border-b py-4">
                <p className="italic">"{review.comment}"</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span>{review.rating}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BabalawoReviews;
