import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  BookOpen, 
  Star, 
  Feather, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Heart, 
  TrendingUp, 
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Mock data for spiritual journey
const journalEntries = [
  {
    id: 1,
    date: '2025-06-15',
    title: 'First Ifá Consultation',
    content: 'Today I had my first Ifá consultation with Babalawo Adeyemi. He revealed that my guardian orisha is Obatala. I need to focus on clarity of thought and purity of intentions.',
    tags: ['Ifá', 'Obatala', 'Guidance']
  },
  {
    id: 2,
    date: '2025-06-01',
    title: 'Reflections on Ritual',
    content: 'Completed the cleansing ritual recommended by Babalawo Adeyemi. I feel much lighter and more focused. The white candle meditation was particularly powerful.',
    tags: ['Ritual', 'Cleansing', 'Meditation']
  },
  {
    id: 3,
    date: '2025-05-20',
    title: 'Dreams and Signs',
    content: "I've been having recurring dreams about water. According to my last consultation, this relates to Yemoja's influence in my life. Need to explore this connection further.",
    tags: ['Dreams', 'Yemoja', 'Signs']
  }
];

const affirmations = [
  {
    id: 1,
    text: "Trust your intuition, it is your connection to the divine.",
    babalawo: "Babalawo Adeyemi",
    date: "2025-06-15"
  },
  {
    id: 2,
    text: "Your path is protected by Obatala. Seek clarity in all decisions.",
    babalawo: "Babalawo Adeyemi",
    date: "2025-06-15"
  },
  {
    id: 3,
    text: "Be mindful of water in your spiritual practice. It carries messages for you.",
    babalawo: "Babalawo Adeyemi",
    date: "2025-05-20"
  }
];

const warnings = [
  {
    id: 1,
    text: "Avoid making important decisions on Wednesdays this month.",
    babalawo: "Babalawo Adeyemi",
    date: "2025-06-15",
    expires: "2025-07-15"
  },
  {
    id: 2,
    text: "Be cautious with new business partnerships until after the next full moon.",
    babalawo: "Babalawo Adeyemi",
    date: "2025-05-20",
    expires: "2025-06-30"
  }
];

const ritualReminders = [
  {
    id: 1,
    title: "Morning Prayer with White Candle",
    description: "Light a white candle and meditate for 15 minutes, focusing on clarity and peace.",
    frequency: "Daily",
    recommended_by: "Babalawo Adeyemi",
    date_recommended: "2025-06-15",
    completed_days: 5,
    total_days: 7
  },
  {
    id: 2,
    title: "Offering to Oshun",
    description: "Prepare a small offering of honey, cinnamon, and yellow flowers near flowing water.",
    frequency: "Once",
    recommended_by: "Babalawo Adeyemi",
    date_recommended: "2025-06-15",
    deadline: "2025-06-22",
    completed: false
  }
];

const favoriteBabalawos = [
  {
    id: 1,
    name: "Babalawo Adeyemi",
    specialty: "Ifá Readings, Destiny Path",
    avatar: "/placeholder.svg",
    rating: 5,
    sessions: 3
  },
  {
    id: 2,
    name: "Babalawo Oloye",
    specialty: "Egbe Consultations, Spiritual Cleansing",
    avatar: "/placeholder.svg",
    rating: 4,
    sessions: 1
  }
];

const growthData = {
  sessions_completed: 4,
  topics_covered: ["Destiny Path", "Love & Relationships", "Career", "Spiritual Growth"],
  first_session_date: "2025-04-10",
  rituals_completed: 5,
  growth_score: 68
};

const SpiritualJourney = () => {
  const [activeTab, setActiveTab] = useState('journal');
  const [newJournalEntry, setNewJournalEntry] = useState({ title: '', content: '', tags: '' });

  const handleJournalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would save the journal entry to the database
    alert('Journal entry saved!');
    setNewJournalEntry({ title: '', content: '', tags: '' });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const calculateProgress = (completed: number, total: number) => {
    return (completed / total) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Spiritual Journey</h1>
          <p className="text-gray-600">Track your growth, reflections, and spiritual guidance</p>
        </div>
        <Button>
          <BookOpen className="mr-2 h-4 w-4" />
          Export Journey
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area - 2/3 width on large screens */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="journal" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="journal">Journal</TabsTrigger>
              <TabsTrigger value="affirmations">Affirmations</TabsTrigger>
              <TabsTrigger value="warnings">Warnings</TabsTrigger>
              <TabsTrigger value="rituals">Rituals</TabsTrigger>
            </TabsList>
            
            <TabsContent value="journal" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">New Journal Entry</CardTitle>
                  <CardDescription>Record your thoughts, experiences, and reflections</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleJournalSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                      </label>
                      <input
                        id="title"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={newJournalEntry.title}
                        onChange={(e) => setNewJournalEntry({...newJournalEntry, title: e.target.value})}
                        placeholder="Give your entry a title..."
                      />
                    </div>
                    <div>
                      <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                        Your Thoughts
                      </label>
                      <Textarea
                        id="content"
                        value={newJournalEntry.content}
                        onChange={(e) => setNewJournalEntry({...newJournalEntry, content: e.target.value})}
                        placeholder="Write your reflections, insights, or experiences..."
                        rows={5}
                      />
                    </div>
                    <div>
                      <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                        Tags (comma separated)
                      </label>
                      <input
                        id="tags"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={newJournalEntry.tags}
                        onChange={(e) => setNewJournalEntry({...newJournalEntry, tags: e.target.value})}
                        placeholder="e.g., Ifá, Meditation, Dreams"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit">
                        <Feather className="mr-2 h-4 w-4" />
                        Save Entry
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800">Previous Entries</h3>
                {journalEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-medium">{entry.title}</CardTitle>
                        <span className="text-sm text-gray-500">{formatDate(entry.date)}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 mb-3">{entry.content}</p>
                      <div className="flex flex-wrap gap-2">
                        {entry.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="bg-primary/5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="affirmations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Affirmations & Guidance</CardTitle>
                  <CardDescription>Positive guidance from your consultations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {affirmations.map((affirmation) => (
                      <div key={affirmation.id} className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="text-gray-800 font-medium mb-2">"{affirmation.text}"</p>
                            <div className="flex justify-between items-center text-sm text-gray-500">
                              <span>{affirmation.babalawo}</span>
                              <span>{formatDate(affirmation.date)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="warnings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Warnings & Cautions</CardTitle>
                  <CardDescription>Important warnings from your consultations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {warnings.map((warning) => (
                      <div key={warning.id} className="p-4 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                          <div>
                            <p className="text-gray-800 font-medium mb-2">"{warning.text}"</p>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500">{warning.babalawo}</span>
                              <span className="text-red-600">
                                Valid until: {formatDate(warning.expires)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="rituals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ritual Reminders</CardTitle>
                  <CardDescription>Track your recommended spiritual practices</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {ritualReminders.map((ritual) => (
                      <div key={ritual.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4 bg-orange-50">
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-gray-800">{ritual.title}</h3>
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                              {ritual.frequency}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{ritual.description}</p>
                        </div>
                        <div className="p-4 bg-white">
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span className="text-gray-500">Recommended by: {ritual.recommended_by}</span>
                            <span className="text-gray-500">On: {formatDate(ritual.date_recommended)}</span>
                          </div>
                          
                          {'completed_days' in ritual && 'total_days' in ritual ? (
                            <div>
                              <div className="flex justify-between items-center text-sm mb-1">
                                <span className="font-medium">Progress</span>
                                <span>{ritual.completed_days} of {ritual.total_days} days</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                  className="bg-primary h-2.5 rounded-full" 
                                  style={{ width: `${calculateProgress(ritual.completed_days, ritual.total_days)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Deadline: {formatDate(ritual.deadline)}</span>
                              <Button size="sm" variant={ritual.completed ? "outline" : "default"}>
                                {ritual.completed ? "Completed" : "Mark Complete"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Sidebar - 1/3 width on large screens */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Spiritual Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Growth Score</span>
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-primary">{growthData.growth_score}</span>
                    <span className="text-sm text-gray-500">/100</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full" 
                    style={{ width: `${growthData.growth_score}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{growthData.sessions_completed}</div>
                    <div className="text-xs text-gray-500">Sessions Completed</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{growthData.topics_covered.length}</div>
                    <div className="text-xs text-gray-500">Topics Explored</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{growthData.rituals_completed}</div>
                    <div className="text-xs text-gray-500">Rituals Completed</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {formatDate(growthData.first_session_date).slice(0, 6)}
                    </div>
                    <div className="text-xs text-gray-500">Journey Started</div>
                  </div>
                </div>
                
                <div className="pt-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Topics Explored</h4>
                  <div className="flex flex-wrap gap-2">
                    {growthData.topics_covered.map((topic, index) => (
                      <Badge key={index} variant="outline" className="bg-primary/5">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Favorite Babalawos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {favoriteBabalawos.map((babalawo) => (
                  <div key={babalawo.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={babalawo.avatar} alt={babalawo.name} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-gray-800 truncate">{babalawo.name}</h4>
                        <div className="flex items-center">
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          <span className="text-xs ml-1">{babalawo.rating}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{babalawo.specialty}</p>
                      <div className="flex items-center mt-1">
                        <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500">{babalawo.sessions} sessions</span>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full">
                  <Heart className="mr-2 h-4 w-4" />
                  Book with a Favorite
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SpiritualJourney;
