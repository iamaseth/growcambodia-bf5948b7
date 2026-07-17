import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "owner" | "farmer" | "staff" | "viewer";

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
    const { supabase, userId } = context;
    // Verify caller can manage this farm (RLS-safe)
    const { data: canManage, error: cmErr } = await supabase.rpc("can_manage_farm", {
      _farm: data.farmId,
      _user: userId,
    });
    if (cmErr) throw cmErr;
    if (!canManage) throw new Error("Not authorized to manage this farm");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
    const { supabase, userId } = context;
    const { data: member, error } = await supabase
      .from("farm_members")
      .select("farm_id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error || !member) throw new Error("Membership not found");
    const { data: canManage } = await supabase.rpc("can_manage_farm", {
      _farm: member.farm_id,
      _user: userId,
    });
    if (!canManage) throw new Error("Not authorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("No email on file for that member");
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (invErr) throw invErr;
    return { ok: true };
  });
