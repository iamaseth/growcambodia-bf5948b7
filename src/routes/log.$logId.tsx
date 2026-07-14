import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Sprout, Calendar, Activity, Users, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UpdateCard } from "@/components/update-card";
import { UpdateComposer } from "@/components/update-composer";
import { CropGuide } from "@/components/crop-guide";
import { NextVisitBadge } from "@/components/next-visit-badge";
import { fetchLog, fetchLogTimeline, type FeedItem } from "@/lib/db";
import { STAGES } from "@/components/update-composer";
import { formatDMY } from "@/lib/date-format";


export const Route = createFileRoute("/log/$logId")({
  component: LogView,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>Plant log not found.</p>
      <Link to="/" className="text-primary hover:underline">Back to feed</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-center space-y-3">
        <p>Couldn't load this log.</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
        <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    );
  },
});

type GroupBy = "day" | "week" | "month";

function bucketKey(date: Date, mode: GroupBy) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (mode === "day") return `${y}-${m}-${d}`;
  if (mode === "month") return `${y}-${m}`;
  // week: ISO week
  const tmp = new Date(Date.UTC(y, date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function bucketLabel(key: string, mode: GroupBy) {
  if (mode === "day") return formatDMY(key);
  if (mode === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  return `Week of ${key.replace("-", " ")}`;

}

function LogView() {
  const { logId } = Route.useParams();
  const logQ = useQuery({ queryKey: ["log", logId], queryFn: () => fetchLog(logId) });
  const timelineQ = useQuery({ queryKey: ["timeline", logId], queryFn: () => fetchLogTimeline(logId) });

  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");

  const log = logQ.data;
  const updates = timelineQ.data ?? [];

  const authors = useMemo(() => {
    const map = new Map<string, string>();
    updates.forEach((u) => map.set(u.user_id, u.profiles?.display_name ?? "Farmer"));
    return Array.from(map.entries());
  }, [updates]);

  const filtered = useMemo(() =>
    updates.filter((u) =>
      (stageFilter === "all" || u.growth_stage === stageFilter) &&
      (authorFilter === "all" || u.user_id === authorFilter),
    ), [updates, stageFilter, authorFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    filtered.forEach((u) => {
      const k = bucketKey(new Date(u.created_at), groupBy);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(u);
    });
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  const currentStage = updates[0]?.growth_stage ?? "—";
  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.toLowerCase() === currentStage.toLowerCase()));
  const stageProgress = updates.length ? ((stageIndex + 1) / STAGES.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14 gap-2">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Feed
            </Button>
          </Link>
          {log && (
            <UpdateComposer
              logId={log.id}
              trigger={<Button size="sm">+ Update</Button>}
            />
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {log && (
          <Card className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Sprout className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-lg leading-tight">{log.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {log.crop_type}{log.variety ? ` · ${log.variety}` : ""} · {log.status}
                </p>
                {log.farms && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {log.farms.name}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <StatTile icon={<Calendar className="h-3 w-3" />} label="Planted" value={log.planted_at ? formatDMY(log.planted_at) : "—"} />
              <StatTile icon={<Activity className="h-3 w-3" />} label="Current stage" value={currentStage} />
              <StatTile icon={<Sprout className="h-3 w-3" />} label="Age" value={log.estimated_age_years != null ? `${log.estimated_age_years} yr` : "—"} />
              <StatTile icon={<Users className="h-3 w-3" />} label="Updates" value={String(updates.length)} />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {log.quantity != null && (
                <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                  {log.quantity} plants/trees
                </span>
              )}
              {log.area_value != null && (
                <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5">
                  {log.area_value} {log.area_unit === "hectares" ? "ha" : "m²"}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Stage progress</span>
                <span>{stageIndex + 1}/{STAGES.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${stageProgress}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                {STAGES.map((s, i) => (
                  <span key={s} className={i === stageIndex ? "text-primary font-medium" : ""}>
                    {s.split("/")[0].slice(0, 4)}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        )}

        {log && <CropGuide cropName={log.crop_type} />}

        <Card className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Filter className="h-3 w-3" /> View
          </div>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-2">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={authorFilter} onValueChange={setAuthorFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Author" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All authors</SelectItem>
                {authors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div className="space-y-4">
          {filtered.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {updates.length === 0
                ? 'No updates yet. Tap "+ Update" to log the first growth stage.'
                : "No updates match these filters."}
            </Card>
          )}
          {groups.map(([key, items]) => (
            <section key={key} className="space-y-2">
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur py-1">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {bucketLabel(key, groupBy)} · {items.length}
                </h2>
              </div>
              <div className="space-y-3">
                {items.map((u) => <UpdateCard key={u.id} item={u} compact />)}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-1.5">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
