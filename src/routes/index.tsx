import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sprout, Map as MapIcon, Rss, LogIn, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FarmMap } from "@/components/farm-map";
import { UpdateCard } from "@/components/update-card";
import { UpdateComposer } from "@/components/update-composer";
import { fetchFarms, fetchFeed, fetchLogsForFarm, type Farm } from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("feed");
  const [focusFarm, setFocusFarm] = useState<Farm | null>(null);

  const farmsQ = useQuery({ queryKey: ["farms"], queryFn: fetchFarms });
  const feedQ = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Sprout className="h-5 w-5" /> CropTrack
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feed"><Rss className="h-4 w-4 mr-1.5" /> Feed</TabsTrigger>
            <TabsTrigger value="map"><MapIcon className="h-4 w-4 mr-1.5" /> Map</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-3 mt-4">
            <h1 className="sr-only">Community feed</h1>
            {feedQ.isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading updates…</p>}
            {feedQ.data && feedQ.data.length === 0 && (
              <Card className="p-8 text-center space-y-2">
                <Sprout className="h-10 w-10 text-primary mx-auto" />
                <p className="font-medium">No updates yet</p>
                <p className="text-sm text-muted-foreground">Be the first to log a growth stage.</p>
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
  const { data: logs } = useQuery({
    queryKey: ["farm-logs", farm.id],
    queryFn: () => fetchLogsForFarm(farm.id),
  });
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold">{farm.name}</h2>
          {farm.address && <p className="text-xs text-muted-foreground">{farm.address}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
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
            <div className="text-xs text-muted-foreground">{l.crop_type} · {l.status}</div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
