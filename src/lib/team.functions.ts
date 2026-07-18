import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "owner" | "farmer" | "staff" | "viewer";

// Authorization helper — mirrors public.can_manage_farm without relying on
// the SECURITY DEFINER RPC (which is no longer executable by authenticated).
async function canManageFarm(
  admin: Awaited<ReturnType<typeof import("@/integrations/supabase/client.server").then>> extends never
    ? never
    : Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  farmId: string,
  userId: string,
): Promise<boolean> {
  const [{ data: farm }, { data: adminRole }, { data: membership }] = await Promise.all([
    admin.from("farms").select("user_id").eq("id", farmId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    admin
      .from("farm_members")
      .select("member_role, status")
      .eq("farm_id", farmId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (adminRole) return true;
  if (farm?.user_id === userId) return true;
  if (membership && (membership.member_role === "owner" || membership.member_role === "staff")) return true;
  return false;
}


export const inviteFarmMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { farmId: string; email: string; role: Role }) => {
      const email = String(input.email ?? "").trim().toLowerCase();
      const role = input.role;
      if (!input.farmId) throw new Error("farmId required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
      if (!["owner", "farmer", "staff", "viewer"].includes(role)) throw new Error("Invalid role");
      return { farmId: input.farmId, email, role };
    },
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await canManageFarm(supabaseAdmin, data.farmId, userId))) {
      throw new Error("Not authorized to manage this farm");
    }


    // Look up user by email
    let targetUserId: string | null = null;
    // paginate users; small tenant — use admin listUsers with filter
    const { data: existing, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (lookupErr) throw lookupErr;
    targetUserId = existing.users.find((u) => u.email?.toLowerCase() === data.email)?.id ?? null;

    if (!targetUserId) {
      const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
      );
      if (invErr) throw invErr;
      targetUserId = invited.user?.id ?? null;
    }
    if (!targetUserId) throw new Error("Could not resolve or invite user");

    // Insert membership (bypasses RLS via admin, but authorization already checked above)
    const { error: insErr } = await supabaseAdmin.from("farm_members").upsert(
      {
        farm_id: data.farmId,
        user_id: targetUserId,
        member_role: data.role,
        status: "invited",
        invited_by: userId,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "farm_id,user_id" },
    );
    if (insErr) throw insErr;
    return { ok: true, userId: targetUserId };
  });

export const resendFarmInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string }) => {
    if (!input.memberId) throw new Error("memberId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error } = await supabaseAdmin
      .from("farm_members")
      .select("farm_id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error || !member) throw new Error("Membership not found");
    if (!(await canManageFarm(supabaseAdmin, member.farm_id, userId))) {
      throw new Error("Not authorized");
    }
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(member.user_id);

    const email = u?.user?.email;
    if (!email) throw new Error("No email on file for that member");
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (invErr) throw invErr;
    return { ok: true };
  });
