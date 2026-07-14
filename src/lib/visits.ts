import { supabase } from "@/integrations/supabase/client";

export type VisitStatus = "scheduled" | "completed" | "overdue" | "cancelled";

export type FarmVisit = {
  id: string;
  user_id: string;
  farm_id: string;
  plant_log_id: string | null;
  title: string;
  visit_type: string;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string | null;
  status: VisitStatus;
  purpose: string | null;
  private_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FarmVisitWithRefs = FarmVisit & {
  farms: { id: string; name: string } | null;
  plant_logs: { id: string; title: string; crop_type: string } | null;
};

/** i18n-ready labels — swap to a real translator later. */
export const t = (s: string) => s;

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDate = (v: FarmVisit) => new Date(v.scheduled_date + "T00:00:00");

/** Client-side derivation so incomplete past visits show as overdue without a cron job. */
export function deriveStatus(v: FarmVisit): VisitStatus {
  if (v.status === "completed" || v.status === "cancelled") return v.status;
  if (toDate(v) < today()) return "overdue";
  return "scheduled";
}

export type VisitBuckets = {
  dueToday: FarmVisitWithRefs[];
  thisWeek: FarmVisitWithRefs[];
  overdue: FarmVisitWithRefs[];
  upcoming: FarmVisitWithRefs[];
  completed: FarmVisitWithRefs[];
};

export function bucketVisits(rows: FarmVisitWithRefs[]): VisitBuckets {
  const t0 = today();
  const weekEnd = new Date(t0);
  weekEnd.setDate(t0.getDate() + 7);

  const out: VisitBuckets = { dueToday: [], thisWeek: [], overdue: [], upcoming: [], completed: [] };
  for (const v of rows) {
    const s = deriveStatus(v);
    if (s === "completed") { out.completed.push(v); continue; }
    if (s === "cancelled") continue;
    const d = toDate(v);
    if (s === "overdue") { out.overdue.push(v); continue; }
    if (d.getTime() === t0.getTime()) { out.dueToday.push(v); continue; }
    if (d > t0 && d <= weekEnd) { out.thisWeek.push(v); continue; }
    if (d > weekEnd) { out.upcoming.push(v); }
  }
  const byDate = (a: FarmVisitWithRefs, b: FarmVisitWithRefs) =>
    a.scheduled_date.localeCompare(b.scheduled_date) ||
    (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "");
  out.dueToday.sort(byDate);
  out.thisWeek.sort(byDate);
  out.overdue.sort(byDate);
  out.upcoming.sort(byDate);
  out.completed.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  return out;
}

export async function fetchMyVisits(userId: string): Promise<FarmVisitWithRefs[]> {
  const { data, error } = await supabase
    .from("farm_visits")
    .select("*, farms(id, name), plant_logs(id, title, crop_type)")
    .eq("user_id", userId)
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FarmVisitWithRefs[];
}

export async function fetchNextVisitForFarm(userId: string, farmId: string): Promise<FarmVisit | null> {
  const t0 = today().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("farm_visits")
    .select("*")
    .eq("user_id", userId)
    .eq("farm_id", farmId)
    .in("status", ["scheduled", "overdue"])
    .gte("scheduled_date", t0)
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as FarmVisit | null;
}

export async function fetchNextVisitForLog(userId: string, logId: string): Promise<FarmVisit | null> {
  const t0 = today().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("farm_visits")
    .select("*")
    .eq("user_id", userId)
    .eq("plant_log_id", logId)
    .in("status", ["scheduled", "overdue"])
    .gte("scheduled_date", t0)
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as FarmVisit | null;
}

export async function createVisit(
  input: {
    farm_id: string;
    plant_log_id?: string | null;
    title: string;
    visit_type?: string;
    scheduled_date: string;
    scheduled_time?: string | null;
    purpose?: string | null;
    private_notes?: string | null;
  },
  userId: string,
): Promise<FarmVisit> {
  const { data, error } = await supabase
    .from("farm_visits")
    .insert({
      user_id: userId,
      farm_id: input.farm_id,
      plant_log_id: input.plant_log_id ?? null,
      title: input.title,
      visit_type: input.visit_type ?? "general",
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time ?? null,
      purpose: input.purpose ?? null,
      private_notes: input.private_notes ?? null,
      status: "scheduled",
    })
    .select()
    .single();
  if (error) throw error;
  return data as FarmVisit;
}

export async function completeVisit(id: string, notesAppend?: string): Promise<void> {
  const patch: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  if (notesAppend) {
    const { data: cur } = await supabase.from("farm_visits").select("private_notes").eq("id", id).maybeSingle();
    const prev = (cur?.private_notes ?? "").trim();
    patch.private_notes = prev ? `${prev}\n\n[Visit notes]\n${notesAppend}` : `[Visit notes]\n${notesAppend}`;
  }
  const { error } = await supabase.from("farm_visits").update(patch).eq("id", id);
  if (error) throw error;
}

export async function cancelVisit(id: string): Promise<void> {
  const { error } = await supabase.from("farm_visits").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export function formatVisitDate(v: Pick<FarmVisit, "scheduled_date" | "scheduled_time">) {
  const d = new Date(v.scheduled_date + "T00:00:00");
  const s = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return v.scheduled_time ? `${s} · ${v.scheduled_time.slice(0, 5)}` : s;
}
