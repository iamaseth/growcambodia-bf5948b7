import { supabase } from "@/integrations/supabase/client";

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

export async function fetchFeed(): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("timeline_updates")
    .select("*, plant_logs(*, farms(*)), profiles(display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const ids = (data ?? []).map((u: any) => u.id);
  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data: cs } = await supabase.from("update_comments").select("update_id").in("update_id", ids);
    (cs ?? []).forEach((c: any) => (counts[c.update_id] = (counts[c.update_id] ?? 0) + 1));
  }
  return (data ?? []).map((u: any) => ({ ...u, comment_count: counts[u.id] ?? 0 })) as FeedItem[];
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
  return (data ?? []).map((u: any) => ({ ...u, comment_count: counts[u.id] ?? 0 })) as FeedItem[];
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

export async function createLog(input: { farm_id: string; title: string; crop_type: string }, userId: string) {
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

export async function fetchComments(updateId: string) {
  const { data, error } = await supabase
    .from("update_comments")
    .select("*")
    .eq("update_id", updateId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as { id: string; author_name: string; body: string; created_at: string; user_id: string }[];
}

export async function addComment(updateId: string, body: string, userId: string, authorName: string) {
  const { error } = await supabase.from("update_comments").insert({
    update_id: updateId,
    user_id: userId,
    author_name: authorName,
    body,
  });
  if (error) throw error;
}
