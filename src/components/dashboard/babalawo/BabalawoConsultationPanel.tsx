import React, { useState } from "react";
import { useBabalawoConsultations } from "@/hooks/useBabalawoConsultations";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRightCircle, FileText, Video, XCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const SessionRow = ({
  session,
  user,
  onNote
}: {
  session: any;
  user: any;
  onNote: (sessionId: string) => void;
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
      <div className="text-xs inline-block px-2 py-0.5 rounded bg-muted">{session.status}</div>
    </div>
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" onClick={() => window.open(`/sessions/${session.id}/video`, "_blank")}>
        <Video className="w-4 h-4" /> Join
      </Button>
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

const HistoryRow = ({
  session,
  user,
  onNote
}: {
  session: any;
  user: any;
  onNote: (sessionId: string) => void;
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
      <div className="text-xs inline-block px-2 py-0.5 rounded bg-muted">{session.status}</div>
    </div>
    <Button size="sm" variant="secondary" onClick={() => onNote(session.id)}>
      <FileText className="w-4 h-4" /> Note
    </Button>
  </div>
);

export default function BabalawoConsultationPanel() {
  const { data, isLoading } = useBabalawoConsultations();
  const [noteModalSession, setNoteModalSession] = useState<string | null>(null);

  // Temporary note modal (not persisted)
  const handleNote = (sessionId: string) => setNoteModalSession(sessionId);

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
    </div>
  );
}
