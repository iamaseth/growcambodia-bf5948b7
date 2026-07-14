import { useQuery } from "@tanstack/react-query";
import { CalendarClock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { deriveStatus, fetchNextVisitForFarm, fetchNextVisitForLog, formatVisitDate, t } from "@/lib/visits";
import { ScheduleVisitDialog } from "@/components/schedule-visit-dialog";
import { Button } from "@/components/ui/button";

export function NextVisitBadge({ farmId, logId }: { farmId?: string; logId?: string }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: logId
      ? ["next-visit-log", user?.id, logId]
      : ["next-visit-farm", user?.id, farmId],
    queryFn: () =>
      logId ? fetchNextVisitForLog(user!.id, logId) : fetchNextVisitForFarm(user!.id, farmId!),
    enabled: !!user && (!!logId || !!farmId),
  });

  if (!user) return null;

  const visit = q.data;
  if (!visit) {
    return (
      <ScheduleVisitDialog
        farmId={farmId}
        plantLogId={logId}
        trigger={
          <Button variant="outline" size="sm" className="h-9">
            <CalendarClock className="h-4 w-4 mr-1.5" /> {t("Schedule visit")}
          </Button>
        }
      />
    );
  }

  const isOverdue = deriveStatus(visit) === "overdue";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs border ${
        isOverdue
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-primary/10 text-primary border-primary/20"
      }`}
    >
      {isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
      <span className="font-medium">
        {isOverdue ? t("Overdue: ") : t("Next visit: ")}
        {formatVisitDate(visit)}
      </span>
    </div>
  );
}
