import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertCircle, CheckCircle2, Clock, CalendarDays, PlayCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { bucketVisits, fetchMyVisits, formatVisitDate, type FarmVisitWithRefs, t } from "@/lib/visits";
import { ScheduleVisitDialog } from "@/components/schedule-visit-dialog";
import { StartVisitDialog } from "@/components/start-visit-dialog";

export function VisitsPanel() {
  const { user } = useAuth();
  const visitsQ = useQuery({
    queryKey: ["my-visits", user?.id],
    queryFn: () => fetchMyVisits(user!.id),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Card className="p-6 text-center space-y-3">
        <CalendarClock className="h-10 w-10 mx-auto text-primary" />
        <p className="font-medium">{t("Sign in to schedule farm visits")}</p>
        <Link to="/auth"><Button className="h-11">{t("Sign in")}</Button></Link>
      </Card>
    );
  }

  const buckets = bucketVisits(visitsQ.data ?? []);
  const total = (visitsQ.data ?? []).length;

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b">
        <ScheduleVisitDialog />
      </div>

      {visitsQ.isLoading && <p className="text-sm text-muted-foreground text-center py-8">{t("Loading visits…")}</p>}

      {!visitsQ.isLoading && total === 0 && (
        <Card className="p-8 text-center space-y-2">
          <CalendarClock className="h-10 w-10 text-primary mx-auto" />
          <p className="font-medium">{t("No visits scheduled yet")}</p>
          <p className="text-sm text-muted-foreground">{t('Tap "Schedule Visit" to plan your first farm visit.')}</p>
        </Card>
      )}

      <Section
        icon={<Clock className="h-4 w-4" />}
        title={t("Due Today")}
        tone="today"
        visits={buckets.dueToday}
        emptyHint={t("Nothing due today.")}
      />
      <Section
        icon={<AlertCircle className="h-4 w-4" />}
        title={t("Overdue")}
        tone="overdue"
        visits={buckets.overdue}
        emptyHint={t("No overdue visits — nice.")}
      />
      <Section
        icon={<CalendarDays className="h-4 w-4" />}
        title={t("This Week")}
        tone="week"
        visits={buckets.thisWeek}
        emptyHint={t("Nothing else this week.")}
      />
      <Section
        icon={<CalendarClock className="h-4 w-4" />}
        title={t("Upcoming")}
        tone="upcoming"
        visits={buckets.upcoming}
        emptyHint={t("Nothing further scheduled.")}
      />
      <Section
        icon={<CheckCircle2 className="h-4 w-4" />}
        title={t("Completed")}
        tone="done"
        visits={buckets.completed.slice(0, 20)}
        emptyHint={t("No completed visits yet.")}
      />
    </div>
  );
}

function Section({
  icon, title, tone, visits, emptyHint,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "today" | "overdue" | "week" | "upcoming" | "done";
  visits: FarmVisitWithRefs[];
  emptyHint: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    today: "bg-primary/10 text-primary border-primary/20",
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    week: "bg-secondary text-secondary-foreground",
    upcoming: "bg-muted text-muted-foreground",
    done: "bg-muted text-muted-foreground",
  };
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          {icon} {title}
        </h2>
        <Badge variant="outline" className={toneClasses[tone]}>{visits.length}</Badge>
      </div>
      {visits.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-1">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => <VisitRow key={v.id} visit={v} completed={tone === "done"} />)}
        </div>
      )}
    </section>
  );
}

function VisitRow({ visit, completed }: { visit: FarmVisitWithRefs; completed: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm leading-tight">{visit.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatVisitDate(visit)} · {visit.farms?.name ?? "—"}
            {visit.plant_logs && <> · <Link className="underline" to="/log/$logId" params={{ logId: visit.plant_logs.id }}>{visit.plant_logs.title}</Link></>}
          </div>
          {visit.purpose && <p className="text-xs mt-1">{visit.purpose}</p>}
        </div>
        {!completed && (
          <StartVisitDialog
            visit={visit}
            trigger={
              <Button size="sm" className="h-10 shrink-0">
                <PlayCircle className="h-4 w-4 mr-1" /> {t("Start")}
              </Button>
            }
          />
        )}
      </div>
    </Card>
  );
}
