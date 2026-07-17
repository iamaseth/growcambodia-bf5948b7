import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sprout, MapPin, CalendarClock, Plus, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchMyMemberships } from "@/lib/team";
import { fetchMySubmissions } from "@/lib/submissions";
import { useAuth } from "@/hooks/use-auth";
import { SubmissionForm } from "@/components/submission-form";

export const Route = createFileRoute("/my-farms")({
  component: MyFarms,
});

function MyFarms() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    // client redirect fallback (public route can't use beforeLoad for auth)
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  }

  const memQ = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: () => (user ? fetchMyMemberships(user.id) : []),
    enabled: !!user,
  });
  const subsQ = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: () => (user ? fetchMySubmissions(user.id) : []),
    enabled: !!user,
  });

  const memberships = memQ.data ?? [];

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Sprout className="h-5 w-5" /> Grow Cambodia
          </Link>
          <span className="text-sm text-muted-foreground">My Farms</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {memQ.isLoading && <p className="text-sm text-muted-foreground">Loading your farms…</p>}
        {!memQ.isLoading && memberships.length === 0 && (
          <Card className="p-8 text-center space-y-2">
            <Sprout className="h-10 w-10 text-primary mx-auto" />
            <p className="font-medium">No farms assigned yet</p>
            <p className="text-sm text-muted-foreground">Ask a farm owner to invite you.</p>
          </Card>
        )}

        {memberships.map((m: any) => {
          const f = m.farms;
          if (!f) return null;
          // Round coordinates for privacy — show general area only.
          const area = `${f.lat.toFixed(2)}, ${f.lng.toFixed(2)}`;
          return (
            <Card key={m.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg">{f.name}</h2>
                  {f.address && <p className="text-xs text-muted-foreground">{f.address}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Area near {area}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {m.member_role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <SubmissionForm
                  defaultFarmId={f.id}
                  defaultType="progress"
                  trigger={
                    <Button className="h-14 text-base" size="lg">
                      <Plus className="h-5 w-5 mr-1.5" /> Add Progress
                    </Button>
                  }
                />
                <SubmissionForm
                  defaultFarmId={f.id}
                  defaultType="problem"
                  trigger={
                    <Button variant="outline" className="h-14 text-base" size="lg">
                      <AlertTriangle className="h-5 w-5 mr-1.5" /> Report Problem
                    </Button>
                  }
                />
              </div>

              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <CalendarClock className="h-3.5 w-3.5" /> View farm on map & timeline
              </Link>
            </Card>
          );
        })}

        {(subsQ.data ?? []).length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">My recent submissions</h3>
            {(subsQ.data ?? []).slice(0, 10).map((s) => (
              <Card key={s.id} className="p-3 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.submission_type} · {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    s.status === "approved" || s.status === "published"
                      ? "bg-primary/10 text-primary"
                      : s.status === "rejected"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted"
                  }`}
                >
                  {s.status}
                </span>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
