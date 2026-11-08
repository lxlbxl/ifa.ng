import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Award, Gift, Share2, Star, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Loyalty = () => {
  const { userProfile } = useAuth();
  
  // Mock loyalty data
  const loyaltyPoints = 750;
  const nextRewardAt = 1000;
  const level = 'Consistent Seeker';
  const badges = [
    { id: 1, name: 'First Session', icon: Star, earned: true, date: 'May 10, 2025' },
    { id: 2, name: 'Consistent Seeker', icon: Calendar, earned: true, date: 'June 1, 2025' },
    { id: 3, name: '5-Star Reviewer', icon: Star, earned: false },
    { id: 4, name: 'Spiritual Explorer', icon: Compass, earned: false },
    { id: 5, name: 'Referral Champion', icon: Users, earned: false },
  ];
  
  return (
    <div className="bg-white/50 p-6 rounded-xl shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <Award className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold text-gray-800">Loyalty & Rewards</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your IFA Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-3xl font-bold text-primary">{loyaltyPoints} pts</div>
                <div className="text-sm text-gray-500">Level: {level}</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current</span>
                  <span>Next Reward: {nextRewardAt} pts</span>
                </div>
                <Progress value={(loyaltyPoints / nextRewardAt) * 100} className="h-2" />
                <div className="text-xs text-gray-500 text-right">
                  {nextRewardAt - loyaltyPoints} points to go
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-primary/5 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">How to Earn</h3>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-center justify-between">
                      <span>Complete a session</span>
                      <span className="font-medium">+100 pts</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Write a review</span>
                      <span className="font-medium">+50 pts</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Refer a friend</span>
                      <span className="font-medium">+200 pts</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Complete profile</span>
                      <span className="font-medium">+25 pts</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-primary/5 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">Rewards</h3>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-center justify-between">
                      <span>500 pts</span>
                      <span className="font-medium">₦1,000 discount</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>1,000 pts</span>
                      <span className="font-medium">Free session</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>2,500 pts</span>
                      <span className="font-medium">Premium badge</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>5,000 pts</span>
                      <span className="font-medium">VIP status</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Refer Friends & Earn</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Invite friends to IFA.ng and earn 200 points for each friend who completes their first session.
                Your friends will also receive a special discount on their first booking!
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Your Referral Link</span>
                  <Button variant="ghost" size="sm" className="h-7 gap-1">
                    <Share2 className="h-3 w-3" />
                    <span className="text-xs">Copy</span>
                  </Button>
                </div>
                <div className="bg-white p-2 rounded border text-xs text-gray-600 truncate">
                  https://ifa.ng/ref/{userProfile?.id || 'user123'}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xl font-bold text-primary mb-1">0</div>
                  <div className="text-xs text-gray-600">Invites Sent</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xl font-bold text-primary mb-1">0</div>
                  <div className="text-xs text-gray-600">Signed Up</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xl font-bold text-primary mb-1">0</div>
                  <div className="text-xs text-gray-600">Points Earned</div>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <Button className="flex-1 gap-1">
                  <Users className="h-4 w-4" />
                  <span>Invite Friends</span>
                </Button>
                <Button variant="outline" className="gap-1">
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {badges.map((badge) => (
                  <div 
                    key={badge.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      badge.earned ? 'bg-primary/10' : 'bg-gray-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      badge.earned ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                      <badge.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className={`font-medium ${badge.earned ? 'text-gray-800' : 'text-gray-500'}`}>
                        {badge.name}
                      </h4>
                      {badge.earned ? (
                        <p className="text-xs text-gray-500">Earned on {badge.date}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Not yet earned</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button variant="outline" className="w-full mt-4">
                View All Badges
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Redeem Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">₦1,000 Discount</h4>
                    <p className="text-xs text-gray-500">Valid for your next session</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    disabled={loyaltyPoints < 500}
                  >
                    500 pts
                  </Button>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Free 30-min Session</h4>
                    <p className="text-xs text-gray-500">With any Babalawo</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    disabled={loyaltyPoints < 1000}
                  >
                    1,000 pts
                  </Button>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Premium Profile Badge</h4>
                    <p className="text-xs text-gray-500">Show your dedication</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    disabled={loyaltyPoints < 2500}
                  >
                    2,500 pts
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Add missing icons
const Calendar = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const Compass = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

export default Loyalty;
