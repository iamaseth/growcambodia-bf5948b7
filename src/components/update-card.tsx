import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Heart,
  MessageCircle,
  MapPin,
  ImageIcon,
  Share2,
  Sparkles,
  BadgeCheck,
  Pin,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  toggleLike,
  fetchMyLikes,
  fetchComments,
  addComment,
  togglePinComment,
  fetchMyRoles,
  type FeedItem,
  type CommentRow,
} from "@/lib/db";
import { toast } from "sonner";
import { PhotoLightbox } from "./photo-lightbox";
import { ShareMenu } from "./share-menu";
import { analyzeUpdate } from "@/lib/analyze-update.functions";
import { formatDMY } from "@/lib/date-format";


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
  const [lightbox, setLightbox] = useState<number | null>(null);

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

  const analyzeFn = useServerFn(analyzeUpdate);
  const analyzeMut = useMutation({
    mutationFn: () => analyzeFn({ data: { updateId: item.id } }),
    onSuccess: () => {
      toast.success("AI analysis added");
      setShowComments(true);
      qc.invalidateQueries({ queryKey: ["comments", item.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Analysis failed"),
  });

  const stageColor = STAGE_COLORS[item.growth_stage.toLowerCase()] ?? "bg-secondary text-secondary-foreground";
  const farm = item.plant_logs?.farms;
  const log = item.plant_logs;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/log/${log?.id ?? ""}#u-${item.id}`
    : `/log/${log?.id ?? ""}`;
  const shareText = `${log?.crop_type ?? "Crop"} update — ${item.growth_stage} on Grow Cambodia`;

  return (
    <Card id={`u-${item.id}`} className="overflow-hidden scroll-mt-20">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold truncate">{item.profiles?.display_name ?? "Farmer"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">{formatDMY(item.created_at)}</span>
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
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(i)}
              className="block w-full aspect-square bg-muted overflow-hidden"
            >
              <img src={url} alt="" loading="lazy" className="w-full h-full object-cover hover:opacity-95 transition" />
            </button>
          ))}
        </div>
      )}

      {item.notes && <p className="px-4 py-3 text-sm whitespace-pre-wrap">{item.notes}</p>}

      <div className="px-2 pb-2 flex items-center gap-0.5 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => likeMut.mutate()}
          className={liked ? "text-red-600" : ""}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""} ${item.likes > 0 ? "mr-1.5" : ""}`} />
          {item.likes > 0 ? item.likes : null}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((v) => !v)}>
          <MessageCircle className={`h-4 w-4 ${item.comment_count > 0 ? "mr-1.5" : ""}`} />
          {item.comment_count > 0 ? item.comment_count : null}
        </Button>

        <ShareMenu
          url={shareUrl}
          text={shareText}
          trigger={<><Share2 className="h-4 w-4 mr-1.5" />Share</>}
        />
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => analyzeMut.mutate()}
            disabled={analyzeMut.isPending}
            title="Ask the AI agronomist"
          >
            <Sparkles className="h-4 w-4 mr-1.5 text-primary" />
            {analyzeMut.isPending ? "Analyzing…" : "Analyze"}
          </Button>
        )}
        {item.image_urls.length > 4 && (
          <span className="text-xs text-muted-foreground ml-auto pr-3 flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> +{item.image_urls.length - 4}
          </span>
        )}
      </div>

      {!compact && log && (
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/log/$logId" params={{ logId: log.id }} className="hover:text-primary flex items-center gap-1">
            View full timeline <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {showComments && <CommentsSection updateId={item.id} logOwnerId={log?.user_id} />}

      {lightbox !== null && (
        <PhotoLightbox images={item.image_urls} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </Card>
  );
}

function CommentsSection({ updateId, logOwnerId: _logOwnerId }: { updateId: string; logOwnerId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments } = useQuery({
    queryKey: ["comments", updateId],
    queryFn: () => fetchComments(updateId),
  });

  const { data: roles } = useQuery({
    queryKey: ["myroles", user?.id],
    queryFn: () => (user ? fetchMyRoles(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const isAgronomist = roles?.includes("agronomist") ?? false;
  const canPin = (roles?.includes("admin") || roles?.includes("moderator")) ?? false;

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      const name = (user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Farmer") as string;
      await addComment(updateId, body.trim(), user.id, name, { isAgronomist });
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", updateId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pinMut = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => togglePinComment(id, pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", updateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const sorted = [...(comments ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
      {sorted.map((c) => (
        <CommentRowView key={c.id} c={c} canPin={canPin} onPin={(id, p) => pinMut.mutate({ id, pinned: p })} />
      ))}
      {user ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Textarea
              rows={1}
              placeholder={isAgronomist ? "Reply as verified agronomist…" : "Write a comment…"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-9 text-sm"
            />
            <Button size="sm" disabled={!body.trim() || mut.isPending} onClick={() => mut.mutate()}>
              Post
            </Button>
          </div>
          {isAgronomist && (
            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
              <BadgeCheck className="h-3 w-3" /> Posting as Verified Agronomist
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to comment.
        </p>
      )}
    </div>
  );
}

function CommentRowView({
  c,
  canPin,
  onPin,
}: {
  c: CommentRow;
  canPin: boolean;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const container = c.is_ai
    ? "border-l-4 border-primary bg-primary/5 rounded-r p-2"
    : c.is_agronomist_reply
    ? "border-l-4 border-emerald-500 bg-emerald-50 rounded-r p-2"
    : "";
  return (
    <div className={`text-sm ${container}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {c.is_ai ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> AI Agronomist
          </span>
        ) : (
          <span className="font-medium">{c.author_name}</span>
        )}
        {c.is_agronomist_reply && !c.is_ai && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
            <BadgeCheck className="h-3 w-3" /> Verified Agronomist
          </span>
        )}
        {c.pinned && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        )}
        <span className="text-muted-foreground text-xs">· {formatDMY(c.created_at)}</span>
        {canPin && (
          <button
            onClick={() => onPin(c.id, !c.pinned)}
            className="ml-auto text-[10px] text-muted-foreground hover:text-primary"
          >
            {c.pinned ? "Unpin" : "Pin"}
          </button>
        )}
        {c.confidence != null && (
          <span className="text-[10px] text-muted-foreground">
            · confidence {Math.round(c.confidence * 100)}%
          </span>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap mt-0.5">{c.body}</p>
    </div>
  );
}
