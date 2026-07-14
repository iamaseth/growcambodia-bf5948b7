import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sprout, Map as MapIcon, Rss, LogIn, LogOut, CalendarIcon, CalendarClock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FarmMap } from "@/components/farm-map";
import { UpdateCard } from "@/components/update-card";
import { UpdateComposer } from "@/components/update-composer";
import { VisitsPanel } from "@/components/visits-panel";
import { NextVisitBadge } from "@/components/next-visit-badge";
import { fetchFarms, fetchFeed, fetchLogsForFarm, updateFarmLocation, type Farm } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDM } from "@/lib/date-format";
import { useQueryClient } from "@tanstack/react-query";
import { LocateFixed, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";



export const Route = createFileRoute("/")({
  component: Home,
});

type Preset = "today" | "week" | "month" | "custom";

function computeRange(preset: Preset, custom: { from?: Date; to?: Date }) {
  const now = new Date();
  const start = new Date(now);
  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: undefined as string | undefined, label: "Today" };
  }
  if (preset === "week") {
    start.setDate(now.getDate() - 7);
    return { from: start.toISOString(), to: undefined, label: "This Week" };
  }
  if (preset === "month") {
    start.setMonth(now.getMonth() - 1);
    return { from: start.toISOString(), to: undefined, label: "This Month" };
  }
  return {
    from: custom.from ? new Date(custom.from.setHours(0, 0, 0, 0)).toISOString() : undefined,
    to: custom.to ? new Date(custom.to.setHours(23, 59, 59, 999)).toISOString() : undefined,
    label: "Custom",
  };
}

function Home() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("feed");
  const [focusFarm, setFocusFarm] = useState<Farm | null>(null);
  const [preset, setPreset] = useState<Preset>("week");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const range = useMemo(() => computeRange(preset, { from: customFrom, to: customTo }), [preset, customFrom, customTo]);

  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: fetchFarms });
  const feedQ = useQuery({
    queryKey: ["feed", range.from ?? "any", range.to ?? "any"],
    queryFn: () => fetchFeed({ from: range.from, to: range.to }),
  });

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Sprout className="h-5 w-5" /> Grow Cambodia
          </Link>
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                <LogIn className="h-4 w-4 mr-1" /> Sign in
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="feed"><Rss className="h-4 w-4 mr-1.5" /> Feed</TabsTrigger>
            <TabsTrigger value="map"><MapIcon className="h-4 w-4 mr-1.5" /> Map</TabsTrigger>
            <TabsTrigger value="visits"><CalendarClock className="h-4 w-4 mr-1.5" /> Visits</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-3 mt-4">
            <h1 className="sr-only">Community feed</h1>

            <div className="flex flex-wrap gap-1.5">
              {(["today", "week", "month", "custom"] as Preset[]).map((p) => {
                const labels: Record<Preset, string> = { today: "Today", week: "This Week", month: "This Month", custom: "Custom" };
                if (p === "custom") {
                  return (
                    <Popover key={p}>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant={preset === "custom" ? "default" : "outline"}
                          className="h-8"
                          onClick={() => setPreset("custom")}
                        >
                          <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                          {preset === "custom" && (customFrom || customTo)
                            ? `${customFrom ? formatDM(customFrom) : "…"} – ${customTo ? formatDM(customTo) : "…"}`
                            : "Custom"}

                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: customFrom, to: customTo }}
                          onSelect={(r) => { setCustomFrom(r?.from); setCustomTo(r?.to); setPreset("custom"); }}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                }
                return (
                  <Button
                    key={p}
                    size="sm"
                    variant={preset === p ? "default" : "outline"}
                    className="h-8"
                    onClick={() => setPreset(p)}
                  >
                    {labels[p]}
                  </Button>
                );
              })}
            </div>

            {feedQ.isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading updates…</p>}
            {!feedQ.isLoading && feedQ.data && feedQ.data.length === 0 && (
              <Card className="p-8 text-center space-y-2">
                <Sprout className="h-10 w-10 text-primary mx-auto" />
                <p className="font-medium">No updates yet — be the first to post</p>
                <p className="text-sm text-muted-foreground">Tap "New update" below to log the first growth stage.</p>
              </Card>
            )}
            {(feedQ.data ?? []).map((item) => <UpdateCard key={item.id} item={item} />)}
          </TabsContent>

          <TabsContent value="map" className="mt-4 space-y-3">
            <FarmMap
              farms={farmsQ.data ?? []}
              onSelectFarm={setFocusFarm}
              height="55vh"
            />
            {focusFarm ? (
              <FarmDetail farm={focusFarm} onClose={() => setFocusFarm(null)} />
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Tap any pin to view its plant logs. {farmsQ.data?.length ?? 0} farms mapped worldwide.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <UpdateComposer />
      </div>
    </div>
  );
}

function FarmDetail({ farm, onClose }: { farm: Farm; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingLoc, setEditingLoc] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const { data: logs } = useQuery({
    queryKey: ["farm-logs", farm.id],
    queryFn: () => fetchLogsForFarm(farm.id),
  });
  const isOwner = user?.id === farm.user_id;

  const saveCoords = async (lat: number, lng: number) => {
    setSavingLoc(true);
    try {
      await updateFarmLocation(farm.id, lat, lng);
      toast.success("Farm location updated");
      qc.invalidateQueries({ queryKey: ["farms"] });
      qc.invalidateQueries({ queryKey: ["myfarms"] });
      setEditingLoc(false);
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't update location");
    } finally {
      setSavingLoc(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => saveCoords(p.coords.latitude, p.coords.longitude),
      (err) => toast.error(err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Couldn't get location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{farm.name}</h2>
          {farm.address && <p className="text-xs text-muted-foreground">{farm.address}</p>}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {farm.lat.toFixed(5)}, {farm.lng.toFixed(5)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      {isOwner && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-2">
          {!editingLoc ? (
            <Button variant="outline" size="sm" onClick={() => setEditingLoc(true)} className="w-full">
              <MapPin className="h-4 w-4 mr-1.5" /> Fix farm location
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Tap anywhere on the map below to drop the correct pin, or use your current location.
              </p>
              <FarmMap
                farms={[farm]}
                onPickLocation={saveCoords}
                height="240px"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={useMyLocation} disabled={savingLoc} className="flex-1">
                  {savingLoc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-1" />}
                  Use my location
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingLoc(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {(logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">No plant logs at this farm yet.</p>}
        {(logs ?? []).map((l) => (
          <Link
            key={l.id}
            to="/log/$logId"
            params={{ logId: l.id }}
            className="block rounded-lg border p-3 hover:bg-muted transition"
          >
            <div className="font-medium text-sm">{l.title}</div>
            <div className="text-xs text-muted-foreground">
              {l.crop_type} · {l.status}
              {l.quantity ? ` · ${l.quantity} plants` : ""}
              {l.area_value ? ` · ${l.area_value} ${l.area_unit === "hectares" ? "ha" : "m²"}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

