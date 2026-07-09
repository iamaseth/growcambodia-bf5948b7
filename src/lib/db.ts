import { supabase } from "@/integrations/supabase/client";
import { signImageUrls } from "@/lib/photo";

async function signFeedImages<T extends { image_urls: string[] }>(rows: T[]): Promise<T[]> {
  await Promise.all(
    rows.map(async (r) => {
      if (r.image_urls?.length) r.image_urls = await signImageUrls(r.image_urls);
    }),
  );
  return rows;
}


export type Farm = {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  created_at: string;
};

export type PlantLog = {
  id: string;
  farm_id: string;
  user_id: string;
  title: string;
  crop_type: string;
  status: string;
  created_at: string;
  estimated_age_years: number | null;
  quantity: number | null;
  area_value: number | null;
  area_unit: string | null;
  variety: string | null;
  planted_at: string | null;
};


export type TimelineUpdate = {
  id: string;
  log_id: string;
  user_id: string;
  growth_stage: string;
  notes: string | null;
  image_urls: string[];
  likes: number;
  created_at: string;
};

export type FeedItem = TimelineUpdate & {
  plant_logs: (PlantLog & { farms: Farm | null }) | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  comment_count: number;
};

export async function fetchFarms(): Promise<Farm[]> {
  const { data, error } = await supabase.from("farms").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Farm[];
}

export async function fetchMyFarms(userId: string): Promise<Farm[]> {
  const { data, error } = await supabase.from("farms").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as Farm[];
}

export async function fetchLogsForFarm(farmId: string): Promise<PlantLog[]> {
  const { data, error } = await supabase.from("plant_logs").select("*").eq("farm_id", farmId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as PlantLog[];
}

export async function fetchMyLogs(userId: string): Promise<(PlantLog & { farms: Farm | null })[]> {
  const { data, error } = await supabase
    .from("plant_logs")
    .select("*, farms(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as any;
}

export async function fetchFeed(range?: { from?: string; to?: string }): Promise<FeedItem[]> {
  let q = supabase
    .from("timeline_updates")
    .select("*, plant_logs(*, farms(*)), profiles(display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (range?.from) q = q.gte("created_at", range.from);
  if (range?.to) q = q.lte("created_at", range.to);
  const { data, error } = await q;
  if (error) throw error;
  const ids = (data ?? []).map((u: any) => u.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: cs } = await supabase.from("update_comments").select("update_id").in("update_id", ids);
    (cs ?? []).forEach((c: any) => (counts[c.update_id] = (counts[c.update_id] ?? 0) + 1));
  }
  const items = (data ?? []).map((u: any) => ({ ...u, comment_count: counts[u.id] ?? 0 })) as FeedItem[];
  return signFeedImages(items);
}


export async function fetchLogTimeline(logId: string) {
  const { data, error } = await supabase
    .from("timeline_updates")
    .select("*, plant_logs(*, farms(*)), profiles(display_name, avatar_url)")
    .eq("log_id", logId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((u: any) => u.id);
  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data: cs } = await supabase.from("update_comments").select("update_id").in("update_id", ids);
    (cs ?? []).forEach((c: any) => (counts[c.update_id] = (counts[c.update_id] ?? 0) + 1));
  }
  const items = (data ?? []).map((u: any) => ({ ...u, comment_count: counts[u.id] ?? 0 })) as FeedItem[];
  return signFeedImages(items);
}

export async function fetchLog(logId: string) {
  const { data, error } = await supabase
    .from("plant_logs")
    .select("*, farms(*)")
    .eq("id", logId)
    .maybeSingle();
  if (error) throw error;
  return data as (PlantLog & { farms: Farm | null }) | null;
}

export async function createFarm(input: { name: string; lat: number; lng: number; address?: string }, userId: string) {
  const { data, error } = await supabase
    .from("farms")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Farm;
}

export async function createLog(
  input: {
    farm_id: string;
    title: string;
    crop_type: string;
    variety?: string | null;
    planted_at?: string | null;
    estimated_age_years?: number | null;
    quantity?: number | null;
    area_value?: number | null;
    area_unit?: string | null;
  },
  userId: string,
) {
  const { data, error } = await supabase
    .from("plant_logs")
    .insert({ ...input, user_id: userId, status: "active" })
    .select()
    .single();
  if (error) throw error;
  return data as PlantLog;
}



export async function createUpdate(
  input: { log_id: string; growth_stage: string; notes: string; image_urls: string[] },
  userId: string,
) {
  const { data, error } = await supabase
    .from("timeline_updates")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as TimelineUpdate;
}

export async function toggleLike(updateId: string, userId: string) {
  const { data: existing } = await supabase
    .from("update_likes")
    .select("update_id")
    .eq("update_id", updateId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase.from("update_likes").delete().eq("update_id", updateId).eq("user_id", userId);
    return false;
  }
  await supabase.from("update_likes").insert({ update_id: updateId, user_id: userId });
  return true;
}

export async function fetchMyLikes(userId: string, updateIds: string[]) {
  if (!updateIds.length) return new Set<string>();
  const { data } = await supabase
    .from("update_likes")
    .select("update_id")
    .eq("user_id", userId)
    .in("update_id", updateIds);
  return new Set((data ?? []).map((r: any) => r.update_id));
}

export type CommentRow = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  user_id: string;
  is_ai: boolean;
  is_agronomist_reply: boolean;
  pinned: boolean;
  category: string | null;
  confidence: number | null;
};

export async function fetchComments(updateId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from("update_comments")
    .select("*")
    .eq("update_id", updateId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentRow[];
}

export async function addComment(updateId: string, body: string, userId: string, authorName: string, opts?: { isAgronomist?: boolean }) {
  const { error } = await supabase.from("update_comments").insert({
    update_id: updateId,
    user_id: userId,
    author_name: authorName,
    body,
    is_agronomist_reply: !!opts?.isAgronomist,
  });
  if (error) throw error;
}

export async function togglePinComment(commentId: string, pinned: boolean) {
  const { error } = await supabase.from("update_comments").update({ pinned }).eq("id", commentId);
  if (error) throw error;
}

export type AppRole = "farmer" | "agronomist" | "moderator" | "admin";

export async function fetchLatestStage(logId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("timeline_updates")
    .select("growth_stage")
    .eq("log_id", logId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data?.growth_stage as string | undefined) ?? null;
}

export async function fetchMyRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r: any) => r.role as AppRole);
}

export async function fetchAdjacentUpdates(logId: string, createdAt: string) {
  const [prev, next] = await Promise.all([
    supabase
      .from("timeline_updates")
      .select("id, created_at, growth_stage")
      .eq("log_id", logId)
      .lt("created_at", createdAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("timeline_updates")
      .select("id, created_at, growth_stage")
      .eq("log_id", logId)
      .gt("created_at", createdAt)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return { prev: prev.data ?? null, next: next.data ?? null };
}

