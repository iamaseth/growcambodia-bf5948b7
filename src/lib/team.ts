import { supabase } from "@/integrations/supabase/client";

export type MemberRole = "owner" | "farmer" | "staff" | "viewer";
export type MemberStatus = "invited" | "active" | "suspended" | "removed";

export type FarmMember = {
  id: string;
  farm_id: string;
  user_id: string;
  member_role: MemberRole;
  status: MemberStatus;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
};

export async function fetchFarmMembers(farmId: string): Promise<FarmMember[]> {
  const { data, error } = await supabase
    .from("farm_members")
    .select("*, profiles:profiles!farm_members_user_id_fkey(display_name, avatar_url)")
    .eq("farm_id", farmId)
    .neq("status", "removed")
    .order("created_at", { ascending: true });
  if (error) {
    // Fallback without profile join if FK not exposed
    const { data: d2, error: e2 } = await supabase
      .from("farm_members")
      .select("*")
      .eq("farm_id", farmId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    if (e2) throw e2;
    return (d2 ?? []) as unknown as FarmMember[];
  }
  return (data ?? []) as unknown as FarmMember[];
}

export async function fetchMyMemberships(userId: string) {
  const { data, error } = await supabase
    .from("farm_members")
    .select("*, farms(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return data ?? [];
}

export async function updateFarmMember(id: string, patch: Partial<Pick<FarmMember, "member_role" | "status">>) {
  const payload: Record<string, unknown> = { ...patch };
  if (patch.status === "active") payload.accepted_at = new Date().toISOString();
  const { error } = await supabase.from("farm_members").update(payload).eq("id", id);
  if (error) throw error;
}

export async function removeFarmMember(id: string) {
  const { error } = await supabase.from("farm_members").update({ status: "removed" }).eq("id", id);
  if (error) throw error;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}
