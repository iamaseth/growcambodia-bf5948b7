import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpdateCard } from "@/components/update-card";
import { UpdateComposer } from "@/components/update-composer";
import { fetchLog, fetchLogTimeline } from "@/lib/db";

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

function LogView() {
  const { logId } = Route.useParams();
  const logQ = useQuery({ queryKey: ["log", logId], queryFn: () => fetchLog(logId) });
  const timelineQ = useQuery({ queryKey: ["timeline", logId], queryFn: () => fetchLogTimeline(logId) });

  const log = logQ.data;

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
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Sprout className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-lg leading-tight">{log.title}</h1>
                <p className="text-sm text-muted-foreground">{log.crop_type} · {log.status}</p>
                {log.farms && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {log.farms.name}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Full history</h2>
          <div className="space-y-3">
            {timelineQ.data && timelineQ.data.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No updates yet. Tap "+ Update" to log the first growth stage.
              </Card>
            )}
            {(timelineQ.data ?? []).map((u) => <UpdateCard key={u.id} item={u} compact />)}
          </div>
        </div>
      </main>
    </div>
  );
}
