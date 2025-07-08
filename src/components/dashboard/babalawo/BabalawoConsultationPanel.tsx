import React, { useState, useEffect } from "react";
import { useBabalawoConsultations } from "@/hooks/useBabalawoConsultations";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRightCircle, FileText, Video, XCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const SessionRow = ({
  session,
  user,
  onNote
}: {
  session: any;
  user: any;
  onNote: (sessionId: string) => void;
}) => {
  const navigate = useNavigate(); // Initialize useNavigate
  const now = new Date();
  const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
  const isJoinable = session.status === 'in_progress' || (session.status === 'confirmed' && sessionDateTime <= new Date(now.getTime() + 15 * 60 * 1000)) || session.is_instant; // Joinable 15 mins before start or if in_progress

  const handleJoinSession = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  return (
    <div className="flex items-center gap-3 border-b py-2">
      <Avatar className="h-8 w-8">
        {user?.avatar_url ? (
          <AvatarImage src={user.avatar_url} />
        ) : (
          <AvatarFallback>{user?.full_name?.charAt(0) ?? "U"}</AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1">
        <div className="font-medium">{user?.full_name ?? "User"}</div>
        <div className="text-xs text-gray-500">{session.session_date} • {session.start_time}</div>
        <div className={`text-xs inline-block px-2 py-0.5 rounded ${
          session.status === 'confirmed' ? 'bg-green-100 text-green-800' :
          session.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          session.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : // Added in_progress style
          'bg-muted'
        }`}>
          {session.status}
        </div>
      </div>
      <div className="flex gap-1">
        {isJoinable && ( // Conditionally render Join Session button
          <Button size="sm" variant="ghost" onClick={() => handleJoinSession(session.id)}>
            <Video className="w-4 h-4" /> Join
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => alert("Reschedule flow coming soon!")} className="hidden md:inline-flex">
          <ArrowRightCircle className="w-4 h-4" /> Reschedule
        </Button>
        <Button size="sm" variant="destructive" onClick={() => alert("Cancel session flow coming soon!")} className="hidden md:inline-flex">
          <XCircle className="w-4 h-4" /> Cancel
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onNote(session.id)}>
          <FileText className="w-4 h-4" /> Note
        </Button>
      </div>
    </div>
  );
};

const HistoryRow = ({
  session,
  user,
  onNote,
  onEditOutcome
}: {
  session: any;
  user: any;
  onNote: (sessionId: string) => void;
  onEditOutcome: (session: any) => void;
}) => (
  <div className="flex items-center gap-3 border-b py-2">
    <Avatar className="h-8 w-8">
      {user?.avatar_url ? (
        <AvatarImage src={user.avatar_url} />
      ) : (
        <AvatarFallback>{user?.full_name?.charAt(0) ?? "U"}</AvatarFallback>
      )}
    </Avatar>
    <div className="flex-1">
      <div className="font-medium">{user?.full_name ?? "User"}</div>
      <div className="text-xs text-gray-500">{session.session_date} • {session.start_time}</div>
      <div className={`text-xs inline-block px-2 py-0.5 rounded ${
        session.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-muted'
      }`}>{session.status}</div>
    </div>
    <div className="flex gap-1">
      <Button size="sm" variant="secondary" onClick={() => onNote(session.id)}>
        <FileText className="w-4 h-4" /> Note
      </Button>
      {session.status === 'completed' &&
        <Button size="sm" variant="outline" onClick={() => onEditOutcome(session)}>
          Edit Outcome
        </Button>
      }
    </div>
  </div>
);

export default function BabalawoConsultationPanel() {
  const { data, isLoading } = useBabalawoConsultations();
  console.log('[BabalawoConsultationPanel] data from hook:', data);
  const [noteModalSession, setNoteModalSession] = useState<string | null>(null);
  const [outcomeModalSession, setOutcomeModalSession] = useState<any>(null);
  const [outcomeData, setOutcomeData] = useState({
    primary_odu: "",
    other_odus: "",
    ritual_recommendations: "",
    items_needed: "",
    deadline: "",
    next_appointment: "",
    warnings: ""
  });

  React.useEffect(() => {
    if (outcomeModalSession) {
      console.log('[BabalawoConsultationPanel] outcomeModalSession changed:', outcomeModalSession);
    }
  }, [outcomeModalSession]);

  React.useEffect(() => {
    console.log('[BabalawoConsultationPanel] outcomeData changed:', outcomeData);
  }, [outcomeData]);

  // Temporary note modal (not persisted)
  const handleNote = (sessionId: string) => setNoteModalSession(sessionId);

  const handleEditOutcome = (session: any) => {
    setOutcomeModalSession(session);
    setOutcomeData({
      primary_odu: session.primary_odu || "",
      other_odus: (session.other_odus || []).join(", "),
      ritual_recommendations: session.ritual_recommendations || "",
      items_needed: JSON.stringify(session.items_needed, null, 2) || "",
      deadline: session.deadline || "",
      next_appointment: session.next_appointment || "",
      warnings: session.warnings || ""
    });
  };

      const handleOutcomeChange = (field: string, value: string) => {
        setOutcomeData(prev => ({ ...prev, [field]: value }));
      };

      const saveOutcome = async () => {
        if (!outcomeModalSession) return;
        const { toast } = useToast();
        try {
          let itemsNeededJson = null;
          try {
            if (outcomeData.items_needed) {
              itemsNeededJson = JSON.parse(outcomeData.items_needed);
            }
          } catch (e) {
            toast({
              title: "Invalid JSON",
              description: "Items Needed must be valid JSON.",
              variant: "destructive",
            });
            return;
          }

          const { error } = await supabase
            .from("sessions")
            .update({
              primary_odu: outcomeData.primary_odu || null,
              other_odus: outcomeData.other_odus.split(",").map((s) => s.trim()).filter(Boolean),
              ritual_recommendations: outcomeData.ritual_recommendations || null,
              items_needed: itemsNeededJson,
              deadline: outcomeData.deadline || null,
              next_appointment: outcomeData.next_appointment || null,
              warning: outcomeData.warnings || null,
            })
            .eq("id", outcomeModalSession.id);

          if (error) {
            toast({
              title: "Error",
              description: "Failed to save outcome: " + error.message,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Success",
              description: "Consultation outcome saved successfully.",
            });
            setOutcomeModalSession(null);
          }
        } catch (err: any) {
          toast({
            title: "Error",
            description: "An unexpected error occurred: " + err.message,
            variant: "destructive",
          });
        }
      };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading
            ? <div>Loading...</div>
            : data?.upcoming?.length ? (
                data.upcoming.map((session: any) =>
                  <SessionRow
                    key={session.id}
                    session={session}
                    user={data.users[session.user_id]}
                    onNote={handleNote}
                  />
              )
            ) : (
              <div>No upcoming bookings.</div>
            )
          }
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading
            ? <div>Loading...</div>
            : data?.history?.length ? (
                data.history.map((session: any) =>
                  <HistoryRow
                    key={session.id}
                    session={session}
                    user={data.users[session.user_id]}
                    onNote={handleNote}
                    onEditOutcome={handleEditOutcome}
                  />
              )
            ) : (
              <div>No session history found.</div>
            )
          }
        </CardContent>
      </Card>

      {/* Notes Modal (Demo only) */}
      {noteModalSession && (
        <div className="fixed z-50 left-0 top-0 w-full h-full bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <div className="font-bold">Session Notes (Private)</div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setNoteModalSession(null)}
              >
                <XCircle />
              </Button>
            </div>
            <textarea className="w-full border rounded p-2 min-h-[120px]" placeholder="Write or edit your notes here..." />
            <div className="flex justify-end mt-4">
              <Button variant="default" onClick={() => {alert("Session notes will be saved in a future update!"); setNoteModalSession(null); }}>
                Save Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Consultation Outcome Modal */}
      {outcomeModalSession && (
        <Dialog open={true} onOpenChange={() => setOutcomeModalSession(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Consultation Outcome</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Primary Odu</label>
                <Input
                  value={outcomeData.primary_odu}
                  onChange={(e) => handleOutcomeChange("primary_odu", e.target.value)}
                  placeholder="Enter Primary Odu"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Other Odus (comma separated)</label>
                <Input
                  value={outcomeData.other_odus}
                  onChange={(e) => handleOutcomeChange("other_odus", e.target.value)}
                  placeholder="Enter Other Odus"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Ebo/Etutu (Ritual)</label>
                <Textarea
                  value={outcomeData.ritual_recommendations}
                  onChange={(e) => handleOutcomeChange("ritual_recommendations", e.target.value)}
                  placeholder="Enter Ritual Recommendations"
                  rows={3}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Items Needed (JSON format)</label>
                <Textarea
                  value={outcomeData.items_needed}
                  onChange={(e) => handleOutcomeChange("items_needed", e.target.value)}
                  placeholder='[{"name": "Item 1", "cost": 1000}]'
                  rows={4}
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Deadline (YYYY-MM-DD or leave blank for flexible)</label>
                <Input
                  type="date"
                  value={outcomeData.deadline}
                  onChange={(e) => handleOutcomeChange("deadline", e.target.value)}
                  placeholder="Enter Deadline"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Next Appointment (YYYY-MM-DD)</label>
                <Input
                  value={outcomeData.next_appointment}
                  onChange={(e) => handleOutcomeChange("next_appointment", e.target.value)}
                  placeholder="Enter Next Appointment Date"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Warnings</label>
                <Textarea
                  value={outcomeData.warnings}
                  onChange={(e) => handleOutcomeChange("warnings", e.target.value)}
                  placeholder="Enter any warnings for the client"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOutcomeModalSession(null)}>Cancel</Button>
              <Button onClick={saveOutcome}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
