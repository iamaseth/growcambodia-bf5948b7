import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, MapPin, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  toggleLike,
  fetchMyLikes,
  fetchComments,
  addComment,
  type FeedItem,
} from "@/lib/db";
import { toast } from "sonner";

const STAGE_COLORS: Record<string, string> = {
  "soil preparation": "bg-stone-100 text-stone-800",
  "seed/planting": "bg-amber-100 text-amber-800",
  seeding: "bg-amber-100 text-amber-800",
  germination: "bg-lime-100 text-lime-800",
  transplant: "bg-emerald-100 text-emerald-800",
  vegetative: "bg-green-100 text-green-800",
  flowering: "bg-pink-100 text-pink-800",
  fruiting: "bg-orange-100 text-orange-800",
  harvest: "bg-yellow-100 text-yellow-800",
};


export function UpdateCard({ item, compact }: { item: FeedItem; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);

  const { data: myLikes } = useQuery({
    queryKey: ["mylikes", user?.id, item.id],
    queryFn: () => (user ? fetchMyLikes(user.id, [item.id]) : Promise.resolve(new Set<string>())),
    enabled: !!user,
  });
  const liked = myLikes?.has(item.id) ?? false;

  const likeMut = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Sign in to like");
      return toggleLike(item.id, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["mylikes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stageColor = STAGE_COLORS[item.growth_stage.toLowerCase()] ?? "bg-secondary text-secondary-foreground";
  const farm = item.plant_logs?.farms;
  const log = item.plant_logs;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold truncate">{item.profiles?.display_name ?? "Farmer"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            {!compact && log && (
              <Link to="/log/$logId" params={{ logId: log.id }} className="text-sm text-primary hover:underline block truncate">
                {log.title} · {log.crop_type}
              </Link>
            )}
            {farm && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="h-3 w-3" /> {farm.name}
              </div>
            )}
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${stageColor}`}>
            {item.growth_stage}
          </span>
        </div>
      </div>

      {item.image_urls.length > 0 && (
        <div className={`grid gap-0.5 ${item.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {item.image_urls.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              loading="lazy"
              className="w-full aspect-square object-cover bg-muted"
            />
          ))}
        </div>
      )}

      {item.notes && <p className="px-4 py-3 text-sm whitespace-pre-wrap">{item.notes}</p>}

      <div className="px-2 pb-2 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => likeMut.mutate()}
          className={liked ? "text-red-600" : ""}
        >
          <Heart className={`h-4 w-4 mr-1.5 ${liked ? "fill-current" : ""}`} />
          {item.likes}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((v) => !v)}>
          <MessageCircle className="h-4 w-4 mr-1.5" />
          {item.comment_count}
        </Button>
        {item.image_urls.length > 4 && (
          <span className="text-xs text-muted-foreground ml-auto pr-3 flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> +{item.image_urls.length - 4}
          </span>
        )}
      </div>

      {showComments && <CommentsSection updateId={item.id} />}
    </Card>
  );
}

function CommentsSection({ updateId }: { updateId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data: comments } = useQuery({
    queryKey: ["comments", updateId],
    queryFn: () => fetchComments(updateId),
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      const name = (user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Farmer") as string;
      await addComment(updateId, body.trim(), user.id, name);
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", updateId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
      {(comments ?? []).map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.author_name}</span>{" "}
          <span className="text-muted-foreground text-xs">· {new Date(c.created_at).toLocaleDateString()}</span>
          <p className="text-sm">{c.body}</p>
        </div>
      ))}
      {user ? (
        <div className="flex gap-2">
          <Textarea
            rows={1}
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-9 text-sm"
          />
          <Button
            size="sm"
            disabled={!body.trim() || mut.isPending}
            onClick={() => mut.mutate()}
          >
            Post
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to comment.
        </p>
      )}
    </div>
  );
}
