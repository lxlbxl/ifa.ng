import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, AlertTriangle, FileText, Package } from "lucide-react";
import { format } from "date-fns";

interface SessionOutcome {
  primary_odu?: string | null;
  other_odus?: string[] | null;
  ritual_recommendations?: string | null;
  items_needed?: string | null;
  deadline?: string | null;
  next_appointment?: string | null;
  warnings?: string | null;
  notes?: string | null;
}

interface SessionOutcomeViewProps {
  outcome: SessionOutcome;
  sessionDate?: string;
  babalawoName?: string;
}

const SessionOutcomeView: React.FC<SessionOutcomeViewProps> = ({
  outcome,
  sessionDate,
  babalawoName
}) => {
  const hasOutcome = outcome.primary_odu || outcome.ritual_recommendations || outcome.notes;

  if (!hasOutcome) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No consultation outcome recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Consultation Outcome
          </CardTitle>
          {(sessionDate || babalawoName) && (
            <div className="text-sm text-gray-600 space-y-1">
              {sessionDate && (
                <p>Session Date: {format(new Date(sessionDate), "PPP")}</p>
              )}
              {babalawoName && <p>Babalawo: {babalawoName}</p>}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Odu Reading */}
      {outcome.primary_odu && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Odu Reading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Primary Odu</h4>
              <Badge variant="default" className="text-lg px-3 py-1">
                {outcome.primary_odu}
              </Badge>
            </div>
            
            {outcome.other_odus && outcome.other_odus.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Supporting Odus</h4>
                <div className="flex flex-wrap gap-2">
                  {outcome.other_odus.map((odu, index) => (
                    <Badge key={index} variant="secondary">
                      {odu}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ritual Recommendations */}
      {outcome.ritual_recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ritual Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{outcome.ritual_recommendations}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Needed */}
      {outcome.items_needed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{outcome.items_needed}</p>
          </CardContent>
        </Card>
      )}

      {/* Important Dates */}
      {(outcome.deadline || outcome.next_appointment) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outcome.deadline && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Ritual Deadline:</span>
                <span>{format(new Date(outcome.deadline), "PPP")}</span>
              </div>
            )}
            {outcome.next_appointment && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Next Appointment:</span>
                <span>{format(new Date(outcome.next_appointment), "PPP")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {outcome.warnings && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Warnings & Precautions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-orange-800">{outcome.warnings}</p>
          </CardContent>
        </Card>
      )}

      {/* Additional Notes */}
      {outcome.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{outcome.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SessionOutcomeView;
