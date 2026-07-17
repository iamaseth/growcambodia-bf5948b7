import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sprout, Check, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { fetchReviewQueue, reviewSubmission, type Submission } from "@/lib/submissions";
import { toast } from "sonner";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!loading && !user) {
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  }

  const queueQ = useQuery({
    queryKey: ["review-queue"],
    queryFn: fetchReviewQueue,
    enabled: !!user,
  });

  const act = async (s: Submission, decision: "approved" | "rejected" | "published") => {
    if (!user) return;
    setBusy(s.id);
    try {
      await reviewSubmission(s.id, decision, user.id, notes[s.id]);
      toast.success(`Marked ${decision}`);
      qc.invalidateQueries({ queryKey: ["review-queue"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Not authorized");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 font-bold text-primary">
            <Sprout className="h-5 w-5" /> Grow Cambodia
          </Link>
          <span className="text-sm text-muted-foreground">Review queue</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {queueQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {queueQ.data && queueQ.data.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">No submissions awaiting review.</Card>
        )}
        {(queueQ.data ?? []).map((s) => (
          <Card key={s.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.submission_type} · submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : ""}
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{s.status}</span>
            </div>
            {s.observations && <p className="text-sm">{s.observations}</p>}
            {s.image_urls?.length > 0 && (
              <div className="text-xs text-muted-foreground">{s.image_urls.length} photo(s)</div>
            )}
            <Textarea
              placeholder="Private review notes (not shown to farmer)"
              value={notes[s.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
              rows={2}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" disabled={busy === s.id} onClick={() => act(s, "approved")}>
                {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Approve
              </Button>
              <Button size="sm" variant="secondary" disabled={busy === s.id} onClick={() => act(s, "published")}>
                Publish
              </Button>
              <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => act(s, "rejected")}>
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
}
